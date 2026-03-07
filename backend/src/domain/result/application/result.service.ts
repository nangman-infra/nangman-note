import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFFont, PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { QueryFailedError, Repository } from 'typeorm';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { PromptDocumentType } from '../../prompt/domain/prompt-document-type.enum';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { RegenerateResultDto } from './dto/regenerate-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { ResultEntity } from '../domain/result.entity';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResultRegenerateEvent } from '../../../shared/events/result-regenerate.event';
import type {
  StructuredLectureExtraction,
  StructuredMeetingExtraction,
  StructuredMentoringExtraction,
  StructuredNoteExtraction,
} from '../../../shared/aws/bedrock/bedrock.types';

type ExportFormat = 'pdf' | 'docx' | 'md';
type AiTranscriptSegment = {
  startTime: number;
  endTime: number;
  text: string;
  speakerLabel?: string;
};

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);
  private readonly regeneratingMeetings = new Set<string>();

  constructor(
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    private readonly meetingService: MeetingService,
    private readonly meetingSearchDocumentService: MeetingSearchDocumentService,
    private readonly promptService: PromptService,
    private readonly bedrockService: BedrockService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  isRegenerating(meetingId: string): boolean {
    return this.regeneratingMeetings.has(meetingId);
  }

  async findByMeetingId(
    meetingId: string,
    ownerSub?: string,
  ): Promise<ResultEntity> {
    const meeting = await this.meetingService.findById(meetingId, ownerSub);

    const existing = await this.resultRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      return existing;
    }

    // COMPLETED 상태에서만 결과 생성 — 전사 완료 전에 조기 생성 방지
    if (meeting.status !== MeetingStatus.COMPLETED) {
      throw new NotFoundException({
        code: 'RESULT_NOT_READY',
        message: `Result for meeting ${meetingId} is not ready yet (status: ${meeting.status})`,
      });
    }

    return this.generateAndSave(meetingId, ownerSub);
  }

  /**
   * 전사 파이프라인 내부 호출용 생성 메서드.
   * 회의 상태가 COMPLETED가 아니어도(예: PROCESSING) 결과를 선생성할 수 있습니다.
   */
  async generateForPipeline(meetingId: string): Promise<ResultEntity> {
    await this.meetingService.findById(meetingId);

    const existing = await this.resultRepository.findOne({
      where: { meetingId },
    });
    if (existing) {
      return existing;
    }

    return this.generateAndSave(meetingId);
  }

  async update(
    meetingId: string,
    dto: UpdateResultDto,
    ownerSub?: string,
  ): Promise<ResultEntity> {
    const existing = await this.findByMeetingId(meetingId, ownerSub);

    existing.content = dto.content;
    existing.metadata = {
      ...existing.metadata,
      noteLength: dto.content.length,
    };

    const saved = await this.resultRepository.save(existing);
    await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
    return saved;
  }

  async regenerate(
    meetingId: string,
    dto: RegenerateResultDto,
    ownerSub?: string,
  ): Promise<ResultEntity> {
    await this.promptService.ensureExists(dto.promptId, ownerSub);
    await this.meetingService.updatePrompt(
      meetingId,
      {
        promptId: dto.promptId,
      },
      ownerSub,
    );

    const existing = await this.findByMeetingId(meetingId, ownerSub);
    const generated = await this.generateResultPayload(
      meetingId,
      dto.promptId,
      ownerSub,
    );

    existing.promptId = generated.promptId;
    existing.content = generated.content;
    existing.metadata = generated.metadata;

    const saved = await this.resultRepository.save(existing);
    await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
    return saved;
  }

  /**
   * 비동기 재생성: 즉시 반환하고 백그라운드에서 Bedrock 호출.
   * 완료/실패 시 EventEmitter로 ResultRegenerateEvent를 발행합니다.
   */
  async regenerateAsync(
    meetingId: string,
    dto: RegenerateResultDto,
    ownerSub?: string,
  ): Promise<void> {
    if (this.regeneratingMeetings.has(meetingId)) {
      throw new BadRequestException(
        `Meeting ${meetingId} is already being regenerated`,
      );
    }

    // 프롬프트 존재 확인 + 변경 (동기)
    await this.promptService.ensureExists(dto.promptId, ownerSub);
    await this.meetingService.updatePrompt(
      meetingId,
      { promptId: dto.promptId },
      ownerSub,
    );

    // 기존 result 존재 확인 (동기)
    await this.findByMeetingId(meetingId, ownerSub);

    // 중복 방지 잠금 + started 이벤트
    this.regeneratingMeetings.add(meetingId);
    this.eventEmitter.emit(
      ResultRegenerateEvent.EVENT_NAME,
      new ResultRegenerateEvent(meetingId, 'started', ownerSub),
    );

    // 백그라운드 실행 (fire-and-forget)
    void this.executeRegenerateInBackground(meetingId, dto.promptId, ownerSub);
  }

  private executeRegenerateInBackground(
    meetingId: string,
    promptId: string,
    ownerSub?: string,
  ): void {
    void (async () => {
      try {
        const existing = await this.resultRepository.findOne({
          where: { meetingId },
        });
        if (!existing) {
          throw new Error(`Result not found for meeting ${meetingId}`);
        }

        const generated = await this.generateResultPayload(
          meetingId,
          promptId,
          ownerSub,
        );

        existing.promptId = generated.promptId;
        existing.content = generated.content;
        existing.metadata = generated.metadata;

        await this.resultRepository.save(existing);
        await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);

        this.logger.log(
          `Async regeneration completed for meeting ${meetingId}`,
        );

        this.eventEmitter.emit(
          ResultRegenerateEvent.EVENT_NAME,
          new ResultRegenerateEvent(meetingId, 'completed', ownerSub),
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Async regeneration failed for meeting ${meetingId}: ${errorMessage}`,
        );

        this.eventEmitter.emit(
          ResultRegenerateEvent.EVENT_NAME,
          new ResultRegenerateEvent(
            meetingId,
            'failed',
            ownerSub,
            errorMessage,
          ),
        );
      } finally {
        this.regeneratingMeetings.delete(meetingId);
      }
    })();
  }

  async exportResult(
    meetingId: string,
    rawFormat?: string,
    ownerSub?: string,
  ): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const result = await this.findByMeetingId(meetingId, ownerSub);
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

  private async generateAndSave(
    meetingId: string,
    ownerSub?: string,
  ): Promise<ResultEntity> {
    // 생성 직전에 한번 더 확인 (race condition 방지)
    const existingCheck = await this.resultRepository.findOne({
      where: { meetingId },
    });
    if (existingCheck) {
      return existingCheck;
    }

    const payload = await this.generateResultPayload(
      meetingId,
      undefined,
      ownerSub,
    );

    try {
      const saved = await this.resultRepository.save(
        this.resultRepository.create({
          meetingId,
          promptId: payload.promptId,
          content: payload.content,
          metadata: payload.metadata,
        }),
      );
      await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
      return saved;
    } catch (error) {
      // UNIQUE constraint 실패 시 이미 생성된 결과를 반환
      if (this.isUniqueConstraintError(error)) {
        this.logger.warn(
          `Duplicate result generation for meeting ${meetingId}, returning existing`,
        );
        const fallback = await this.resultRepository.findOne({
          where: { meetingId },
        });
        if (fallback) {
          await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
          return fallback;
        }
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as
      | {
          code?: string;
          errno?: number;
          message?: string;
        }
      | undefined;

    if (
      driverError?.code === '23505' || // PostgreSQL unique_violation
      driverError?.code === 'ER_DUP_ENTRY' || // MySQL duplicate entry
      driverError?.code === 'SQLITE_CONSTRAINT' || // SQLite generic constraint
      driverError?.code === 'SQLITE_CONSTRAINT_UNIQUE' || // SQLite unique constraint
      driverError?.errno === 1062 // MySQL duplicate entry errno
    ) {
      return true;
    }

    const message =
      `${error.message} ${driverError?.message ?? ''}`.toLowerCase();
    return (
      message.includes('unique constraint failed') ||
      message.includes('duplicate key') ||
      message.includes('duplicate entry')
    );
  }

  private async generateResultPayload(
    meetingId: string,
    overridePromptId?: string,
    ownerSub?: string,
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
    const meeting = await this.meetingService.findById(meetingId, ownerSub);
    const promptId = overridePromptId ?? meeting.promptId;
    const prompt = await this.promptService.findById(promptId, ownerSub);

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

    const hasContent = noteContent.length > 0 || transcripts.length > 0;

    return {
      promptId,
      content: hasContent
        ? await this.generateContentWithAI({
            meeting,
            prompt,
            noteContent,
            transcripts,
          })
        : this.buildEmptyContentNotice(meeting),
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

    const transcriptText = this.buildTranscriptTextForAI(transcripts);

    try {
      const extracted = await this.bedrockService.extractStructuredNotes({
        documentType: prompt.documentType,
        promptContent: prompt.content.trim(),
        noteContent: noteContent || '',
        transcriptText,
        meetingTitle: meeting.title?.trim(),
        meetingAgenda: meeting.agenda?.trim(),
      });
      const aiContent = this.renderStructuredMarkdown({
        meeting,
        documentType: prompt.documentType,
        extracted,
      });

      if (aiContent && aiContent.trim().length > 0) {
        return aiContent;
      }

      this.logger.warn(
        `Structured extraction rendered empty content for meeting ${meeting.id}, trying legacy fallback`,
      );
    } catch (error) {
      this.logger.warn(
        `Structured extraction failed for meeting ${meeting.id}: ${error instanceof Error ? error.message : 'Unknown error'}. Trying legacy fallback.`,
      );
    }

    try {
      const legacyContent = await this.bedrockService.generateMeetingResult({
        promptContent: prompt.content.trim(),
        noteContent: noteContent || '',
        transcriptText,
        meetingTitle: meeting.title?.trim(),
        meetingAgenda: meeting.agenda?.trim(),
      });

      if (legacyContent && legacyContent.trim().length > 0) {
        return legacyContent;
      }
    } catch (error) {
      this.logger.error(
        `Legacy Bedrock generation failed for meeting ${meeting.id}: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback template.`,
      );
    }

    return this.buildFallbackContent(params);
  }

  private buildTranscriptTextForAI(
    transcripts: TranscriptSegmentEntity[],
  ): string {
    const preprocessed = this.preprocessTranscriptsForAI(transcripts);

    return preprocessed
      .filter((segment) => segment.text.length > 0)
      .map((segment) => {
        const speakerPrefix = segment.speakerLabel
          ? `[화자: ${segment.speakerLabel}] `
          : '';
        return `[${segment.startTime.toFixed(1)}s ~ ${segment.endTime.toFixed(1)}s] ${speakerPrefix}${segment.text}`;
      })
      .join('\n');
  }

  private renderStructuredMarkdown(params: {
    meeting: MeetingEntity;
    documentType: PromptDocumentType;
    extracted: StructuredNoteExtraction;
  }): string {
    const { meeting, documentType, extracted } = params;

    if (documentType === PromptDocumentType.MEETING) {
      return this.renderMeetingMarkdown(
        meeting,
        extracted as StructuredMeetingExtraction,
      );
    }

    if (documentType === PromptDocumentType.LECTURE) {
      return this.renderLectureMarkdown(
        meeting,
        extracted as StructuredLectureExtraction,
      );
    }

    return this.renderMentoringMarkdown(
      meeting,
      extracted as StructuredMentoringExtraction,
    );
  }

  private renderMeetingMarkdown(
    meeting: MeetingEntity,
    extracted: StructuredMeetingExtraction,
  ): string {
    const title = meeting.title?.trim() || '제목 없는 회의';
    const agendaSections =
      extracted.agendaItems.length > 0
        ? extracted.agendaItems.flatMap((item, index) => [
            `### 안건 ${index + 1}: ${item.title}`,
            '',
            '**핵심 논의:**',
            this.renderBulletList(item.discussionPoints, '주요 논의 추출 없음'),
            '',
            '**결정사항:**',
            this.renderBulletList(item.decisions, '확정된 결정 없음'),
            '',
            '**액션 아이템:**',
            this.renderActionItems(item.actionItems),
            '',
            '**미해결 사항:**',
            this.renderBulletList(item.unresolved, '없음'),
            '',
          ])
        : ['- 안건별 논의가 추출되지 않았습니다.', ''];

    const totalActionItems = extracted.agendaItems.reduce(
      (sum, item) => sum + item.actionItems.length,
      0,
    );

    return [
      `# ${title}`,
      '',
      '## 참여자',
      this.renderBulletList(extracted.participants, '확인 불가'),
      '',
      '## 회의 개요',
      extracted.summary || '_요약 추출 없음_',
      '',
      '## 안건별 논의',
      ...agendaSections,
      '## 전체 요약',
      '**주요 결정:**',
      this.renderBulletList(extracted.overallDecisions, '확정된 결정 없음'),
      '',
      `**총 액션 아이템:** ${totalActionItems}개`,
      '',
      '**후속 안건:**',
      this.renderBulletList(extracted.followUps, '없음'),
      '',
      '## 핵심 키워드',
      this.renderKeywordLine(extracted.keywords),
      '',
      '## 확인 필요 / 불확실',
      this.renderBulletList(extracted.uncertainties, '없음'),
    ].join('\n');
  }

  private renderLectureMarkdown(
    meeting: MeetingEntity,
    extracted: StructuredLectureExtraction,
  ): string {
    const title = meeting.title?.trim() || '제목 없는 강의';
    const concepts =
      extracted.concepts.length > 0
        ? extracted.concepts.flatMap((concept, index) => [
            `### ${index + 1}. ${concept.name}`,
            `- **정의:** ${concept.definition || '정의 추출 없음'}`,
            `- **예시:** ${concept.example || '예시 추출 없음'}`,
            `- **핵심 포인트:** ${this.renderInlineList(concept.keyPoints, '핵심 포인트 추출 없음')}`,
            '',
          ])
        : ['- 핵심 개념 추출 없음', ''];

    return [
      `# ${title}`,
      '',
      '## 강의 요약',
      extracted.summary || '_요약 추출 없음_',
      '',
      '## 핵심 개념',
      ...concepts,
      '## 실습 및 적용',
      this.renderBulletList(extracted.practiceItems, '실습/과제 추출 없음'),
      '',
      extracted.keyTakeaways.length > 0
        ? `## 기억해야 할 ${Math.min(extracted.keyTakeaways.length, 5)}가지`
        : '## 핵심 정리',
      this.renderOrderedList(extracted.keyTakeaways, 5),
      '',
      '## 핵심 키워드',
      this.renderKeywordLine(extracted.keywords),
      '',
      '## 확인 필요 / 불확실',
      this.renderBulletList(extracted.uncertainties, '없음'),
    ].join('\n');
  }

  private renderMentoringMarkdown(
    meeting: MeetingEntity,
    extracted: StructuredMentoringExtraction,
  ): string {
    const title = meeting.title?.trim() || '제목 없는 멘토링';
    const topicSections =
      extracted.topics.length > 0
        ? extracted.topics.flatMap((topic, index) => [
            `### 주제 ${index + 1}: ${topic.title}`,
            '',
            '**핵심 포인트:**',
            this.renderBulletList(topic.keyPoints, '핵심 포인트 추출 없음'),
            '',
            '**실무 팁:**',
            this.renderBulletList(topic.practicalTips, '실무 팁 추출 없음'),
            '',
            '**후속 과제:**',
            this.renderBulletList(topic.followUpTasks, '후속 과제 없음'),
            '',
            '**추가 조사 키워드:**',
            this.renderBulletList(topic.researchTopics, '추가 조사 항목 없음'),
            '',
            '**주의할 점:**',
            this.renderBulletList(topic.cautions, '없음'),
            '',
          ])
        : ['- 핵심 주제 추출 없음', ''];

    return [
      `# ${title}`,
      '',
      '## 세션 요약',
      extracted.summary || '_요약 추출 없음_',
      '',
      '## 핵심 주제',
      ...topicSections,
      '## 오늘 가져갈 것',
      this.renderBulletList(extracted.keyTakeaways, '핵심 정리 없음'),
      '',
      '## 핵심 키워드',
      this.renderKeywordLine(extracted.keywords),
      '',
      '## 확인 필요 / 불확실',
      this.renderBulletList(extracted.uncertainties, '없음'),
    ].join('\n');
  }

  private renderBulletList(items: string[], emptyText: string): string {
    if (items.length === 0) {
      return `- ${emptyText}`;
    }

    return items.map((item) => `- ${item}`).join('\n');
  }

  private renderOrderedList(items: string[], limit: number): string {
    const source = items.slice(0, limit);
    if (source.length === 0) {
      return '- 핵심 정리 추출 없음';
    }

    return source.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  private renderActionItems(
    items: StructuredMeetingExtraction['agendaItems'][number]['actionItems'],
  ): string {
    if (items.length === 0) {
      return '- 작업: 없음 / 담당: 미정 / 마감: 미정 / 우선순위: Medium';
    }

    return items
      .map(
        (item) =>
          `- 작업: ${item.task} / 담당: ${item.owner} / 마감: ${item.deadline} / 우선순위: ${item.priority}`,
      )
      .join('\n');
  }

  private renderKeywordLine(keywords: string[]): string {
    return keywords.length > 0
      ? keywords.join(', ')
      : '_핵심 키워드 추출 없음_';
  }

  private renderInlineList(items: string[], emptyText: string): string {
    return items.length > 0 ? items.join('; ') : emptyText;
  }

  private buildEmptyContentNotice(meeting: MeetingEntity): string {
    const title = meeting.title?.trim() || '제목 없는 회의';
    const generatedAt = new Date().toLocaleString('ko-KR');
    return [
      `# ${title}`,
      '',
      '> 📝 이 회의에는 작성된 노트와 수집된 전사 데이터가 없습니다.',
      '',
      `- 생성 시각: ${generatedAt}`,
      '',
      '회의 내용을 추가하려면 **편집** 버튼을 눌러 직접 작성하거나,',
      '다음 회의에서 노트를 작성하고 마이크를 활성화해주세요.',
    ].join('\n');
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

  /**
   * Bedrock에 전달하기 전 전사 세그먼트를 전처리합니다.
   * DB 원본은 변경하지 않고, 순수 데이터 객체 배열을 반환합니다.
   *
   * 처리 단계:
   * 1. startTime 기준 정렬 재검증
   * 2. 한국어 필러/간투사 세그먼트 제거 (학술 근거: 한국음성학회 담화표지 연구)
   * 3. 연속 동일 텍스트 중복 제거
   * 4. 3자 이하 초단편 세그먼트를 직전 세그먼트에 병합
   */
  private preprocessTranscriptsForAI(
    segments: TranscriptSegmentEntity[],
  ): AiTranscriptSegment[] {
    if (segments.length === 0) return [];

    // 한국어 필러/간투사 정규식 (한국음성학회 담화표지 '아','어','음' 연구 + Quizlet 필러 목록 기반)
    const FILLER_ONLY_REGEX = /^[어음아네예응그저막자뭐에오]+[.?!]?$/;
    const PUNCTUATION_ONLY_REGEX = /^[.?!,;:…]+$/;

    // 1. startTime 기준 정렬 (안전장치)
    const sorted: AiTranscriptSegment[] = segments
      .map((segment) => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: segment.text.trim(),
        speakerLabel: segment.speakerLabel ?? undefined,
      }))
      .sort((a, b) => a.startTime - b.startTime);

    // 2. 필러 세그먼트 + 구두점만 있는 세그먼트 제거
    const filtered = sorted.filter((seg) => {
      if (seg.text.length === 0) return false;
      if (seg.text.length <= 4 && FILLER_ONLY_REGEX.test(seg.text))
        return false;
      if (PUNCTUATION_ONLY_REGEX.test(seg.text)) return false;
      return true;
    });

    // 3. 같은 화자/인접 시간대의 연속 동일 텍스트만 중복 제거
    const deduped: AiTranscriptSegment[] = [];
    for (const seg of filtered) {
      const previous = deduped[deduped.length - 1];
      if (previous && this.isConsecutiveDuplicateTranscript(previous, seg)) {
        previous.endTime = Math.max(previous.endTime, seg.endTime);
        continue;
      }

      deduped.push({ ...seg });
    }

    // 4. 3자 이하 초단편은 같은 화자일 때만 직전 세그먼트에 병합
    const result: AiTranscriptSegment[] = [];

    for (const seg of deduped) {
      if (this.canMergeShortTranscript(result[result.length - 1], seg)) {
        const prev = result[result.length - 1];
        prev.text = `${prev.text} ${seg.text}`;
        prev.endTime = Math.max(prev.endTime, seg.endTime);
      } else {
        result.push({ ...seg });
      }
    }

    return result;
  }

  private isConsecutiveDuplicateTranscript(
    previous: AiTranscriptSegment,
    current: AiTranscriptSegment,
  ): boolean {
    return (
      previous.text === current.text &&
      this.hasSameSpeaker(previous.speakerLabel, current.speakerLabel) &&
      this.getSegmentGapSeconds(previous, current) <= 1.5
    );
  }

  private canMergeShortTranscript(
    previous: AiTranscriptSegment | undefined,
    current: AiTranscriptSegment,
  ): boolean {
    if (!previous) {
      return false;
    }

    return (
      current.text.length <= 3 &&
      this.hasSameSpeaker(previous.speakerLabel, current.speakerLabel) &&
      this.getSegmentGapSeconds(previous, current) <= 1.5
    );
  }

  private hasSameSpeaker(first?: string, second?: string): boolean {
    const normalizedFirst = first?.trim() ?? '';
    const normalizedSecond = second?.trim() ?? '';
    return normalizedFirst === normalizedSecond;
  }

  private getSegmentGapSeconds(
    previous: Pick<AiTranscriptSegment, 'endTime'>,
    current: Pick<AiTranscriptSegment, 'startTime'>,
  ): number {
    return Math.max(0, current.startTime - previous.endTime);
  }

  private loadPdfFontBytes(): Uint8Array | null {
    const candidates = [
      // Docker 컨테이너 (Pretendard TTF, font stage에서 복사)
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'assets',
        'fonts',
        'KoreanFont.ttf',
      ),
      '/app/assets/fonts/KoreanFont.ttf',
      // macOS 시스템 폰트 (개발 환경 폴백)
      '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
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
