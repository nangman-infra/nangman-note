import { BadRequestException, Injectable } from '@nestjs/common';
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

type ExportFormat = 'pdf' | 'docx' | 'md';

@Injectable()
export class ResultService {
  constructor(
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    private readonly meetingService: MeetingService,
    private readonly promptService: PromptService,
  ) {}

  async findByMeetingId(meetingId: string): Promise<ResultEntity> {
    await this.meetingService.findById(meetingId);

    const existing = await this.resultRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      return existing;
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
        take: 24,
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
      content: this.buildGeneratedContent({
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

  private buildGeneratedContent(params: {
    meeting: MeetingEntity;
    prompt: PromptEntity;
    noteContent: string;
    transcripts: TranscriptSegmentEntity[];
  }): string {
    const { meeting, prompt, noteContent, transcripts } = params;

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
      `- 생성 시각: ${generatedAt}`,
      `- 적용 프롬프트: ${prompt.name} (\`${prompt.id}\`)`,
      '',
      '## 프롬프트 지시',
      prompt.content.trim(),
      '',
      '## 노트',
      noteContent || '_아직 저장된 노트가 없습니다._',
      '',
      '## 전사 하이라이트',
      transcriptHighlights.length > 0
        ? transcriptHighlights.join('\n')
        : '_아직 수집된 전사 데이터가 없습니다._',
      '',
      '## 다음 액션 제안',
      '- 결정사항 검토',
      '- 담당자와 마감일 확정',
      '- 후속 회의 일정 등록',
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
    let pdfLines = [`# ${title}`, '', ...content.split('\n')];

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
    const bodyLines = content.split('\n');
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
      const cleaned = line.replace(/^#{1,6}\s*/, '').trim();
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
