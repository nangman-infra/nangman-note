import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import {
  getRequestContext,
  runWithRequestContext,
  type RequestContextStore,
} from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';
import type {
  StructuredLectureExtraction,
  StructuredMeetingExtraction,
  StructuredMentoringExtraction,
  StructuredNoteExtraction,
} from '../../../shared/aws/bedrock/bedrock.types';

type AiTranscriptSegment = {
  startTime: number;
  endTime: number;
  text: string;
  speakerLabel?: string;
};

interface ValidationResult {
  valid: boolean;
  stage: 'structural' | 'quality' | 'consistency';
  reason: string;
}

@Injectable()
export class ResultService {
  private readonly logger = new StructuredLogger(ResultService.name);
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
    this.logger.log('result.regeneration.started', {
      meetingId,
      promptId: dto.promptId,
      ownerSub,
    });
    this.eventEmitter.emit(
      ResultRegenerateEvent.EVENT_NAME,
      new ResultRegenerateEvent(meetingId, 'started', ownerSub),
    );

    // 백그라운드 실행 (fire-and-forget)
    void this.executeRegenerateInBackground(
      meetingId,
      dto.promptId,
      ownerSub,
      getRequestContext(),
    );
  }

  private executeRegenerateInBackground(
    meetingId: string,
    promptId: string,
    ownerSub?: string,
    requestContext?: RequestContextStore,
  ): void {
    void runWithRequestContext(
      {
        ...requestContext,
        requestId: requestContext?.requestId,
        transport: 'job',
        meetingId,
        ownerSub,
      },
      async () => {
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

          this.logger.log('result.regeneration.completed', {
            meetingId,
            promptId,
            ownerSub,
          });

          this.eventEmitter.emit(
            ResultRegenerateEvent.EVENT_NAME,
            new ResultRegenerateEvent(meetingId, 'completed', ownerSub),
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error('result.regeneration.failed', error, {
            meetingId,
            promptId,
            ownerSub,
          });

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
      },
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
        this.logger.warn('result.generation.duplicate', {
          meetingId,
        });
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
    const maxAttempts = 3; // original + 2 retries

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const extracted = await this.bedrockService.extractStructuredNotes({
          documentType: prompt.documentType,
          promptContent: prompt.content.trim(),
          noteContent: noteContent || '',
          transcriptText,
          meetingTitle: meeting.title?.trim(),
          meetingAgenda: meeting.agenda?.trim(),
        });

        const validation = this.validateExtraction({
          extracted,
          documentType: prompt.documentType,
          transcriptText,
          translateTargetLanguage: meeting.translateTargetLanguage?.trim(),
          languageCode: meeting.languageCode?.trim(),
        });

        if (validation.valid) {
          const aiContent = this.renderStructuredMarkdown({
            meeting,
            documentType: prompt.documentType,
            extracted,
          });

          if (aiContent && aiContent.trim().length > 0) {
            return aiContent;
          }

          this.logger.warn('result.structured_extraction.empty_render', {
            meetingId: meeting.id,
            promptId: prompt.id,
            attempt,
            maxAttempts,
            documentType: prompt.documentType,
          });
        } else {
          this.logger.warn('result.structured_extraction.validation_failed', {
            meetingId: meeting.id,
            promptId: prompt.id,
            attempt,
            maxAttempts,
            documentType: prompt.documentType,
            validationStage: validation.stage,
            validationReason: validation.reason,
          });
        }
      } catch (error) {
        this.logger.warn('result.structured_extraction.failed', {
          meetingId: meeting.id,
          promptId: prompt.id,
          attempt,
          maxAttempts,
          documentType: prompt.documentType,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy Fallback
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
      this.logger.error('result.legacy_generation.failed', error, {
        meetingId: meeting.id,
        promptId: prompt.id,
        documentType: prompt.documentType,
      });
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
        ? extracted.agendaItems.flatMap((item, index) => {
            const contextParagraph = this.renderContextParagraph(
              item.context as string | undefined,
            );
            return [
              `### 안건 ${index + 1}: ${item.title}`,
              '',
              ...(contextParagraph ? [contextParagraph] : []),
              '**핵심 논의:**',
              this.renderNumberedList(
                item.discussionPoints,
                '주요 논의 추출 없음',
              ),
              '',
              '**결정사항:**',
              this.renderNumberedList(item.decisions, '확정된 결정 없음'),
              '',
              '**액션 아이템:**',
              this.renderActionItemTable(item.actionItems),
              '',
              '**미해결 사항:**',
              this.renderBulletList(item.unresolved, '없음'),
              '',
            ];
          })
        : ['- 안건별 논의가 추출되지 않았습니다.', ''];

    const totalActionItems = extracted.agendaItems.reduce(
      (sum, item) => sum + item.actionItems.length,
      0,
    );

    const participantsLine =
      extracted.participants.length > 0
        ? this.renderInlineNarrativeList(extracted.participants)
        : '확인 불가';

    return [
      `# ${title}`,
      '',
      '## 참여자',
      participantsLine,
      '',
      '## 회의 개요',
      this.renderNarrativeParagraph(extracted.summary, '_요약 추출 없음_'),
      '',
      '## 안건별 논의',
      ...agendaSections,
      '## 전체 요약',
      '**주요 결정:**',
      this.renderNumberedList(extracted.overallDecisions, '확정된 결정 없음'),
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
        ? extracted.concepts.flatMap((concept, index) => {
            const contextParagraph = this.renderContextParagraph(
              concept.context as string | undefined,
            );
            return [
              `### ${index + 1}. ${concept.name}`,
              '',
              ...(contextParagraph ? [contextParagraph] : []),
              '**정의:**',
              concept.definition || '_정의 추출 없음_',
              '',
              '**예시:**',
              concept.example
                ? this.renderBlockquoteList([concept.example], '예시 추출 없음')
                : '_예시 추출 없음_',
              '',
              '**핵심 포인트:**',
              this.renderNumberedList(
                concept.keyPoints,
                '핵심 포인트 추출 없음',
              ),
              '',
            ];
          })
        : ['_핵심 개념 추출 없음_', ''];

    return [
      `# ${title}`,
      '',
      '## 강의 요약',
      this.renderNarrativeParagraph(extracted.summary, '_요약 추출 없음_'),
      '',
      '## 핵심 개념',
      ...concepts,
      '## 실습 및 적용',
      this.renderChecklist(extracted.practiceItems, '실습/과제 추출 없음'),
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
        ? extracted.topics.flatMap((topic, index) => {
            const contextParagraph = this.renderContextParagraph(
              topic.context as string | undefined,
            );
            return [
              `### 주제 ${index + 1}: ${topic.title}`,
              '',
              ...(contextParagraph ? [contextParagraph] : []),
              '**핵심 포인트:**',
              this.renderNumberedList(topic.keyPoints, '핵심 포인트 추출 없음'),
              '',
              '**실무 팁:**',
              this.renderBlockquoteList(
                topic.practicalTips,
                '_실무 팁 추출 없음_',
              ),
              '',
              '**후속 과제:**',
              this.renderChecklist(topic.followUpTasks, '후속 과제 없음'),
              '',
              '**추가 조사 키워드:**',
              this.renderBulletList(
                topic.researchTopics,
                '추가 조사 항목 없음',
              ),
              '',
              '**주의할 점:**',
              this.renderBlockquoteList(topic.cautions, '_없음_'),
              '',
            ];
          })
        : ['_핵심 주제 추출 없음_', ''];

    return [
      `# ${title}`,
      '',
      '## 세션 요약',
      this.renderNarrativeParagraph(extracted.summary, '_요약 추출 없음_'),
      '',
      '## 핵심 주제',
      ...topicSections,
      '## 오늘 가져갈 것',
      this.renderNumberedList(extracted.keyTakeaways, '핵심 정리 없음'),
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
  private renderBlockquoteList(items: string[], emptyText: string): string {
    if (items.length === 0) {
      return emptyText;
    }
    return items.map((item) => `> ${item}`).join('\n\n');
  }

  private renderChecklist(items: string[], emptyText: string): string {
    if (items.length === 0) {
      return `- ${emptyText}`;
    }
    return items.map((item) => `- [ ] ${item}`).join('\n');
  }

  private renderActionItemTable(
    items: StructuredMeetingExtraction['agendaItems'][number]['actionItems'],
  ): string {
    if (items.length === 0) {
      return '_액션 아이템 없음_';
    }
    const header = '| 작업 | 담당 | 마감 | 우선순위 |';
    const separator = '| --- | --- | --- | --- |';
    const rows = items.map(
      (item) =>
        `| ${item.task} | ${item.owner} | ${item.deadline} | ${item.priority} |`,
    );
    return [header, separator, ...rows].join('\n');
  }

  private renderContextParagraph(context?: string): string {
    if (!context || context.trim().length === 0) {
      return '';
    }
    return `${context.trim()}\n`;
  }

  private renderNarrativeParagraph(
    text: string | undefined,
    emptyText: string,
  ): string {
    if (!text) {
      return emptyText;
    }

    const normalized = text
      .split('\n')
      .map((line) => this.normalizeNarrativeLine(line))
      .filter((line) => line.length > 0)
      .join(' ')
      .trim();

    return normalized.length > 0 ? normalized : emptyText;
  }

  private renderNumberedList(items: string[], emptyText: string): string {
    if (items.length === 0) {
      return `- ${emptyText}`;
    }
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  private renderInlineList(items: string[], emptyText: string): string {
    return items.length > 0 ? items.join('; ') : emptyText;
  }

  private renderInlineNarrativeList(items: string[]): string {
    const normalized = items
      .map((item) => this.normalizeNarrativeLine(item))
      .filter((item) => item.length > 0);

    return normalized.length > 0 ? normalized.join(', ') : '확인 불가';
  }

  private normalizeNarrativeLine(text: string): string {
    return text
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
      .replace(/\s+/g, ' ')
      .trim();
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

  // ── Validation Layer ──

  private validateExtraction(params: {
    extracted: StructuredNoteExtraction;
    documentType: PromptDocumentType;
    transcriptText: string;
    translateTargetLanguage?: string;
    languageCode?: string;
  }): ValidationResult {
    const {
      extracted,
      documentType,
      transcriptText,
      translateTargetLanguage,
      languageCode,
    } = params;

    const structureResult = this.validateStructure(extracted, documentType);
    if (!structureResult.valid) return structureResult;

    const qualityResult = this.validateQuality(extracted, transcriptText);
    if (!qualityResult.valid) return qualityResult;

    const consistencyResult = this.validateConsistency(extracted, {
      translateTargetLanguage,
      languageCode,
    });
    if (!consistencyResult.valid) return consistencyResult;

    return { valid: true, stage: 'consistency', reason: '' };
  }

  private validateStructure(
    extracted: StructuredNoteExtraction,
    documentType: PromptDocumentType,
  ): ValidationResult {
    const fail = (reason: string): ValidationResult => ({
      valid: false,
      stage: 'structural',
      reason,
    });

    if (!extracted || typeof extracted !== 'object') {
      return fail('Extraction result is not an object');
    }

    if (!('documentType' in extracted) || !extracted.documentType) {
      return fail('Missing documentType field');
    }

    if (extracted.documentType !== documentType) {
      return fail(
        `documentType mismatch: expected ${documentType}, got ${extracted.documentType}`,
      );
    }

    if (typeof extracted.summary !== 'string') {
      return fail('summary field is not a string');
    }

    if (documentType === PromptDocumentType.MEETING) {
      const meeting = extracted as StructuredMeetingExtraction;
      if (!Array.isArray(meeting.agendaItems)) {
        return fail('Missing or invalid agendaItems array');
      }
    } else if (documentType === PromptDocumentType.LECTURE) {
      const lecture = extracted as StructuredLectureExtraction;
      if (!Array.isArray(lecture.concepts)) {
        return fail('Missing or invalid concepts array');
      }
    } else {
      const mentoring = extracted as StructuredMentoringExtraction;
      if (!Array.isArray(mentoring.topics)) {
        return fail('Missing or invalid topics array');
      }
    }

    return { valid: true, stage: 'structural', reason: '' };
  }

  private validateQuality(
    extracted: StructuredNoteExtraction,
    transcriptText: string,
  ): ValidationResult {
    const fail = (reason: string): ValidationResult => ({
      valid: false,
      stage: 'quality',
      reason,
    });

    if (!extracted.summary || extracted.summary.length < 10) {
      return fail(
        `Summary too short: ${extracted.summary?.length ?? 0} chars (minimum 10)`,
      );
    }

    const primaryArray = this.getPrimaryArray(extracted);
    const hasTranscriptContent = transcriptText.trim().length > 0;

    if (primaryArray.length === 0 && hasTranscriptContent) {
      return fail(
        'Primary array is empty despite transcript content being available',
      );
    }

    if (primaryArray.length > 0) {
      const emptyRatio = this.calculateEmptySubFieldRatio(extracted);
      if (emptyRatio > 0.5) {
        return fail(
          `Too many empty sub-fields: ${(emptyRatio * 100).toFixed(0)}% empty (maximum 50%)`,
        );
      }
    }

    return { valid: true, stage: 'quality', reason: '' };
  }

  private getPrimaryArray(extracted: StructuredNoteExtraction): unknown[] {
    if ('agendaItems' in extracted) return extracted.agendaItems;
    if ('concepts' in extracted) return extracted.concepts;
    if ('topics' in extracted) return extracted.topics;
    return [];
  }

  private calculateEmptySubFieldRatio(
    extracted: StructuredNoteExtraction,
  ): number {
    let totalArrayFields = 0;
    let emptyArrayFields = 0;

    const checkArrayFields = (obj: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'context' || key === 'documentType') continue;
        if (Array.isArray(value)) {
          totalArrayFields++;
          if (value.length === 0) emptyArrayFields++;
        }
      }
    };

    const primaryArray = this.getPrimaryArray(extracted);
    for (const item of primaryArray) {
      if (item && typeof item === 'object') {
        checkArrayFields(item as Record<string, unknown>);
      }
    }

    return totalArrayFields === 0 ? 0 : emptyArrayFields / totalArrayFields;
  }

  private validateConsistency(
    extracted: StructuredNoteExtraction,
    params: { translateTargetLanguage?: string; languageCode?: string },
  ): ValidationResult {
    const fail = (reason: string): ValidationResult => ({
      valid: false,
      stage: 'consistency',
      reason,
    });

    const { translateTargetLanguage, languageCode } = params;

    if (!translateTargetLanguage && !languageCode) {
      return { valid: true, stage: 'consistency', reason: '' };
    }

    const expectedScript = translateTargetLanguage
      ? this.languageToScript(translateTargetLanguage)
      : this.languageCodeToScript(languageCode!);

    if (!expectedScript) {
      return { valid: true, stage: 'consistency', reason: '' };
    }

    const dominantScript = this.detectDominantScript(extracted.summary);

    if (dominantScript === 'unknown') {
      return { valid: true, stage: 'consistency', reason: '' };
    }

    if (dominantScript !== expectedScript) {
      return fail(
        `Language mismatch: expected ${expectedScript}, detected ${dominantScript} in summary`,
      );
    }

    return { valid: true, stage: 'consistency', reason: '' };
  }

  private detectDominantScript(
    text: string,
  ): 'ko' | 'ja' | 'zh' | 'latin' | 'unknown' {
    // Remove spaces, digits, punctuation, symbols
    const cleaned = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
    if (cleaned.length === 0) return 'unknown';

    const koRegex = /[\uAC00-\uD7AF\u3131-\u3163]/g;
    const jaRegex = /[\u3040-\u309F\u30A0-\u30FF]/g;
    const zhRegex = /[\u4E00-\u9FFF]/g;
    const latinRegex = /[A-Za-z]/g;

    const koCount = (cleaned.match(koRegex) || []).length;
    const jaCount = (cleaned.match(jaRegex) || []).length;
    const zhCount = (cleaned.match(zhRegex) || []).length;
    const latinCount = (cleaned.match(latinRegex) || []).length;

    const total = cleaned.length;
    const threshold = 0.5;

    // Korean and Japanese take priority over Chinese (CJK overlap)
    if (koCount / total >= threshold) return 'ko';
    if (jaCount / total >= threshold) return 'ja';
    if (zhCount / total >= threshold) return 'zh';
    if (latinCount / total >= threshold) return 'latin';

    return 'unknown';
  }

  private languageToScript(
    language: string,
  ): 'ko' | 'ja' | 'zh' | 'latin' | null {
    const lower = language.toLowerCase();
    if (lower.includes('korean') || lower.includes('한국어') || lower === 'ko')
      return 'ko';
    if (
      lower.includes('japanese') ||
      lower.includes('일본어') ||
      lower === 'ja'
    )
      return 'ja';
    if (lower.includes('chinese') || lower.includes('중국어') || lower === 'zh')
      return 'zh';
    if (lower.includes('english') || lower.includes('영어') || lower === 'en')
      return 'latin';
    if (
      lower.includes('french') ||
      lower.includes('german') ||
      lower.includes('spanish') ||
      lower.includes('portuguese') ||
      lower.includes('italian')
    )
      return 'latin';
    return null;
  }

  private languageCodeToScript(
    code: string,
  ): 'ko' | 'ja' | 'zh' | 'latin' | null {
    const prefix = code.split('-')[0]?.toLowerCase();
    if (prefix === 'ko') return 'ko';
    if (prefix === 'ja') return 'ja';
    if (prefix === 'zh') return 'zh';
    if (
      prefix === 'en' ||
      prefix === 'fr' ||
      prefix === 'de' ||
      prefix === 'es' ||
      prefix === 'pt' ||
      prefix === 'it'
    )
      return 'latin';
    return null;
  }

}
