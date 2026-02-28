import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { existsSync, readFileSync } from 'fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFFont, PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Repository } from 'typeorm';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { RegenerateResultDto } from './dto/regenerate-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { ResultEntity } from '../domain/result.entity';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';

type ExportFormat = 'pdf' | 'docx' | 'md';

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);

  constructor(
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    private readonly meetingService: MeetingService,
    private readonly promptService: PromptService,
    private readonly bedrockService: BedrockService,
  ) {}

  async findByMeetingId(meetingId: string): Promise<ResultEntity> {
    const meeting = await this.meetingService.findById(meetingId);

    const existing = await this.resultRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      return existing;
    }

    // COMPLETED 상태에서만 결과 생성 — 전사 완료 전에 조기 생성 방지
    if (meeting.status !== 'completed') {
      throw new NotFoundException(
        `Result for meeting ${meetingId} is not ready yet (status: ${meeting.status})`,
      );
    }

    return this.generateAndSave(meetingId);
  }

  async update(meetingId: string, dto: UpdateResultDto): Promise<ResultEntity> {
    const existing = await this.findByMeetingId(meetingId);

    existing.content = dto.content;
    existing.metadata = {
      ...existing.metadata,
      noteLength: dto.content.length,
    };

    return this.resultRepository.save(existing);
  }

  async regenerate(
    meetingId: string,
    dto: RegenerateResultDto,
  ): Promise<ResultEntity> {
    await this.promptService.ensureExists(dto.promptId);
    await this.meetingService.updatePrompt(meetingId, {
      promptId: dto.promptId,
    });

    const existing = await this.findByMeetingId(meetingId);
    const generated = await this.generateResultPayload(meetingId, dto.promptId);

    existing.promptId = generated.promptId;
    existing.content = generated.content;
    existing.metadata = generated.metadata;

    return this.resultRepository.save(existing);
  }

  async exportResult(
    meetingId: string,
    rawFormat?: string,
  ): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const result = await this.findByMeetingId(meetingId);
    const format = this.resolveFormat(rawFormat);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'md') {
      return {
        fileName: `meeting_${meetingId}_${stamp}.md`,
        contentType: 'text/markdown; charset=utf-8',
        buffer: Buffer.from(result.content, 'utf-8'),
      };
    }
    const title = result.metadata.title?.trim() || 'Meeting Result';
    const buffer =
      format === 'pdf'
        ? await this.renderPdfBuffer(title, result.content)
        : await this.renderDocxBuffer(title, result.content);

    return {
      fileName: `meeting_${meetingId}_${stamp}.${format}`,
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    };
  }

  private resolveFormat(rawFormat?: string): ExportFormat {
    if (!rawFormat) {
      return 'pdf';
    }

    if (rawFormat === 'pdf' || rawFormat === 'docx' || rawFormat === 'md') {
      return rawFormat;
    }

    throw new BadRequestException(
      'Unsupported export format. Use one of: pdf, docx, md',
    );
  }

  private async generateAndSave(meetingId: string): Promise<ResultEntity> {
    const payload = await this.generateResultPayload(meetingId);

    return this.resultRepository.save(
      this.resultRepository.create({
        meetingId,
        promptId: payload.promptId,
        content: payload.content,
        metadata: payload.metadata,
      }),
    );
  }

  private async generateResultPayload(
    meetingId: string,
    overridePromptId?: string,
  ): Promise<{
    promptId: string;
    content: string;
    metadata: {
      title?: string;
      generatedAt: string;
      totalDuration: number;
      transcriptWordCount: number;
      noteLength: number;
    };
  }> {
    const meeting = await this.meetingService.findById(meetingId);
    const promptId = overridePromptId ?? meeting.promptId;
    const prompt = await this.promptService.findById(promptId);

    const [note, transcripts] = await Promise.all([
      this.noteRepository.findOne({
        where: { meetingId },
      }),
      this.transcriptRepository.find({
        where: { meetingId },
        order: { startTime: 'ASC' },
      }),
    ]);

    const noteContent = note?.content?.trim() ?? '';
    const transcriptWordCount = transcripts
      .map((segment) => segment.text)
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const durationByMeeting = meeting.endedAt
      ? Math.max(
          0,
          Math.floor(
            (meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000,
          ),
        )
      : 0;
    const durationByTranscript = Math.max(
      0,
      ...transcripts.map((segment) => Math.floor(segment.endTime)),
    );

    return {
      promptId,
      content: await this.generateContentWithAI({
        meeting,
        prompt,
        noteContent,
        transcripts,
      }),
      metadata: {
        title: meeting.title,
        generatedAt: new Date().toISOString(),
        totalDuration: Math.max(durationByMeeting, durationByTranscript),
        transcriptWordCount,
        noteLength: noteContent.length,
      },
    };
  }

  private async generateContentWithAI(params: {
    meeting: MeetingEntity;
    prompt: PromptEntity;
    noteContent: string;
    transcripts: TranscriptSegmentEntity[];
  }): Promise<string> {
    const { meeting, prompt, noteContent, transcripts } = params;

    const transcriptText = transcripts
      .filter((segment) => segment.text?.trim())
      .map(
        (segment) =>
          `[${segment.startTime.toFixed(1)}s ~ ${segment.endTime.toFixed(1)}s] ${segment.text.trim()}`,
      )
      .join('\n');

    try {
      const aiContent = await this.bedrockService.generateMeetingResult({
        promptContent: prompt.content.trim(),
        noteContent: noteContent || '',
        transcriptText,
        meetingTitle: meeting.title?.trim(),
      });

      if (aiContent && aiContent.trim().length > 0) {
        return aiContent;
      }

      this.logger.warn(
        `Bedrock returned empty content for meeting ${meeting.id}, using fallback`,
      );
      return this.buildFallbackContent(params);
    } catch (error) {
      this.logger.error(
        `Bedrock generation failed for meeting ${meeting.id}: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback template.`,
      );
      return this.buildFallbackContent(params);
    }
  }

  private buildFallbackContent(params: {
    meeting: MeetingEntity;
    prompt: PromptEntity;
    noteContent: string;
    transcripts: TranscriptSegmentEntity[];
  }): string {
    const { meeting, noteContent, transcripts } = params;

    const title = meeting.title?.trim() || '제목 없는 회의';
    const generatedAt = new Date().toLocaleString('ko-KR');
    const transcriptHighlights = transcripts
      .filter((segment) => segment.text?.trim())
      .slice(0, 8)
      .map(
        (segment) =>
          `- [${segment.startTime.toFixed(1)}s ~ ${segment.endTime.toFixed(1)}s] ${segment.text.trim()}`,
      );

    const sections = [
      `# ${title}`,
      '',
      `> ⚠️ AI 회의록 생성에 일시적 문제가 발생하여 기본 정리 결과를 제공합니다. 프롬프트를 변경하여 재생성하거나, 잠시 후 다시 시도해주세요.`,
      '',
      `- 생성 시각: ${generatedAt}`,
      '',
      '## 노트 내용',
      noteContent || '_작성된 노트가 없습니다._',
      '',
      '## 전사 하이라이트',
      transcriptHighlights.length > 0
        ? transcriptHighlights.join('\n')
        : '_수집된 전사 데이터가 없습니다._',
    ];

    return sections.join('\n');
  }

  private async renderPdfBuffer(
    title: string,
    content: string,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const customFontBytes = this.loadPdfFontBytes();
    let font: PDFFont;
    let pdfLines = [title, '', ...this.convertMarkdownToPlainLines(content)];

    if (customFontBytes) {
      pdfDoc.registerFontkit(fontkit);
      font = await pdfDoc.embedFont(customFontBytes, { subset: true });
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      pdfLines = pdfLines.map((line) => line.replace(/[^\x20-\x7e]/g, '?'));
    }

    const margin = 44;
    const fontSize = 10.5;
    const lineHeight = 15;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const maxLineWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = page.getHeight() - margin;
    const lines = this.wrapLines(pdfLines, font, fontSize, maxLineWidth);

    for (const line of lines) {
      if (cursorY <= margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = page.getHeight() - margin;
      }

      page.drawText(line, {
        x: margin,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0.1, 0.12, 0.16),
      });
      cursorY -= lineHeight;
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private async renderDocxBuffer(
    title: string,
    content: string,
  ): Promise<Buffer> {
    const bodyLines = this.convertMarkdownToPlainLines(content);
    const children: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32,
          }),
        ],
      }),
      new Paragraph({ text: '' }),
    ];

    for (const line of bodyLines) {
      const cleaned = line.trim();
      if (cleaned.length === 0) {
        children.push(new Paragraph({ text: '' }));
        continue;
      }

      children.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, size: 22 })],
        }),
      );
    }

    const document = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return Packer.toBuffer(document);
  }

  private convertMarkdownToPlainLines(markdown: string): string[] {
    const sourceLines = markdown.replace(/\r\n/g, '\n').split('\n');
    const lines: string[] = [];
    let inCodeBlock = false;

    for (const rawLine of sourceLines) {
      const trimmed = rawLine.trim();

      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        lines.push('');
        continue;
      }

      if (inCodeBlock) {
        lines.push(rawLine.length > 0 ? `    ${rawLine}` : '');
        continue;
      }

      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        lines.push('');
        continue;
      }

      const headingMatch = rawLine.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        lines.push(this.stripMarkdownInline(headingMatch[2]).trim());
        lines.push('');
        continue;
      }

      const quoteMatch = rawLine.match(/^\s{0,3}>\s?(.*)$/);
      if (quoteMatch) {
        const quoteContent = this.stripMarkdownInline(quoteMatch[1]).trim();
        lines.push(quoteContent.length > 0 ? `인용: ${quoteContent}` : '');
        continue;
      }

      const unorderedMatch = rawLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (unorderedMatch) {
        const indent = Math.min(Math.floor(unorderedMatch[1].length / 2), 3);
        const bulletContent = this.stripMarkdownInline(
          unorderedMatch[2],
        ).trim();
        lines.push(`${'  '.repeat(indent)}• ${bulletContent}`);
        continue;
      }

      const orderedMatch = rawLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
      if (orderedMatch) {
        const indent = Math.min(Math.floor(orderedMatch[1].length / 2), 3);
        const numberContent = this.stripMarkdownInline(orderedMatch[3]).trim();
        lines.push(
          `${'  '.repeat(indent)}${orderedMatch[2]}. ${numberContent}`,
        );
        continue;
      }

      lines.push(this.stripMarkdownInline(rawLine).trim());
    }

    return this.compressBlankLines(lines);
  }

  private stripMarkdownInline(source: string): string {
    let line = source;

    line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, altText: string) =>
      altText?.trim().length > 0 ? `[이미지: ${altText.trim()}]` : '[이미지]',
    );
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    line = line.replace(/`([^`]+)`/g, '$1');
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    line = line.replace(/__([^_]+)__/g, '$1');
    line = line.replace(/\*([^*]+)\*/g, '$1');
    line = line.replace(/_([^_]+)_/g, '$1');
    line = line.replace(/~~([^~]+)~~/g, '$1');
    line = line.replace(/\\([\\`*_{}()[\]#+\-.!>])/g, '$1');
    line = line.replace(/\s+/g, ' ');

    return line;
  }

  private compressBlankLines(lines: string[]): string[] {
    const compact: string[] = [];
    let previousWasBlank = false;

    for (const line of lines) {
      const isBlank = line.trim().length === 0;
      if (isBlank) {
        if (!previousWasBlank) {
          compact.push('');
        }
      } else {
        compact.push(line);
      }
      previousWasBlank = isBlank;
    }

    while (compact.length > 0 && compact[0] === '') {
      compact.shift();
    }
    while (compact.length > 0 && compact[compact.length - 1] === '') {
      compact.pop();
    }

    return compact;
  }

  private wrapLines(
    sourceLines: string[],
    font: PDFFont,
    fontSize: number,
    maxLineWidth: number,
  ): string[] {
    const lines: string[] = [];

    for (const rawLine of sourceLines) {
      const normalized = rawLine.replace(/\t/g, '    ');
      if (normalized.length === 0) {
        lines.push('');
        continue;
      }

      let cursor = '';
      const words = normalized.split(/\s+/).filter((word) => word.length > 0);

      if (words.length === 0) {
        lines.push('');
        continue;
      }

      for (const word of words) {
        const candidate = cursor.length === 0 ? word : `${cursor} ${word}`;
        const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

        if (candidateWidth <= maxLineWidth) {
          cursor = candidate;
          continue;
        }

        if (cursor.length > 0) {
          lines.push(cursor);
        }

        cursor = word;
      }

      if (cursor.length > 0) {
        lines.push(cursor);
      }
    }

    return lines;
  }

  private loadPdfFontBytes(): Uint8Array | null {
    const candidates = [
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/Library/Fonts/Arial Unicode.ttf',
    ];

    for (const path of candidates) {
      if (existsSync(path)) {
        return readFileSync(path);
      }
    }

    return null;
  }
}
