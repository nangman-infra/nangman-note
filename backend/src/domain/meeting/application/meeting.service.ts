import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
import {
  MeetingSearchDocumentService,
  type MeetingSearchDocumentRow,
} from './meeting-search-document.service';
import {
  MeetingStatusChangedEvent,
  type MeetingStatusPhase,
} from '../../../shared/events/meeting-status-changed.event';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingProcessingPhase } from '../domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../domain/meeting-transcription-mode.enum';
import { ResultEntity } from '../../result/domain/result.entity';
import { TranscriptionJobEntity } from '../../transcription/domain/transcription-job.entity';
import { unsettledTranscriptionJobWhere } from '../../transcription/domain/transcription-job.constants';
import { TranscriptionUploadEntity } from '../../transcription/domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../../transcription/domain/transcription-upload-status.enum';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import type { MeetingStatsDto } from './dto/meeting-stats.dto';
import { SearchMeetingsQueryDto } from './dto/search-meetings-query.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { StructuredLogger } from '../../../shared/logging/structured-logger';
import { MeetingCompletionState } from '../domain/meeting-completion-state.enum';

const DEFAULT_PROMPT_ID = 'prompt_default_meeting';
const SEARCH_SCOPES = ['all', 'title', 'result', 'transcript', 'note'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];
export type SearchMatchedIn = Exclude<SearchScope, 'all'>;

export interface MeetingSearchResult {
  meetingId: string;
  title?: string;
  status: MeetingStatus;
  processingPhase?: MeetingProcessingPhase | null;
  needsAttention: boolean;
  completionState?: MeetingCompletionState | null;
  transcriptionMode: MeetingTranscriptionMode;
  matchedIn: SearchMatchedIn;
  snippet: string;
  startedAt: Date;
}

@Injectable()
export class MeetingService {
  private readonly logger = new StructuredLogger(MeetingService.name);

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptionUploadEntity)
    private readonly transcriptionUploadRepository: Repository<TranscriptionUploadEntity>,
    private readonly promptService: PromptService,
    private readonly eventEmitter: EventEmitter2,
    private readonly meetingSearchDocumentService: MeetingSearchDocumentService,
  ) {}

  async create(
    dto: CreateMeetingDto,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const promptId = dto.promptId || DEFAULT_PROMPT_ID;
    const transcriptionMode =
      dto.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
    await this.promptService.ensureExists(promptId, ownerSub);

    const meeting = this.meetingRepository.create({
      ownerSub: ownerSub?.trim() || undefined,
      title: dto.title?.trim() || undefined,
      agenda: dto.agenda?.trim() || undefined,
      promptId,
      status: MeetingStatus.RECORDING,
      transcriptionMode,
      languageCode: dto.languageCode?.trim() || undefined,
      translateTargetLanguage: dto.translateTargetLanguage?.trim() || undefined,
      startedAt: new Date(),
    });

    const saved = await this.meetingRepository.save(meeting);
    await this.meetingSearchDocumentService.refreshByMeetingId(saved.id);
    this.logger.log('meeting.created', {
      meetingId: saved.id,
      ownerSub: saved.ownerSub,
      promptId: saved.promptId,
      transcriptionMode: saved.transcriptionMode,
    });
    return saved;
  }

  async list(
    query: ListMeetingsQueryDto,
    ownerSub?: string,
  ): Promise<{
    meetings: MeetingEntity[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [meetings, total] = await this.meetingRepository.findAndCount({
      where: ownerSub ? { ownerSub } : undefined,
      order: { startedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      meetings,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * 대시보드 집계. 목록 API는 페이지 단위(기본 50개)라 클라이언트에서 합산하면
   * 로드된 창(window)만 반영된다. 여기서는 소유자의 전체 회의를 한 번에 읽어
   * 상태별 개수·총 전사 시간·최근 7일 분포를 서버에서 계산한다.
   * DB 엔진(sqlite/postgres)에 무관하도록 날짜 연산은 애플리케이션에서 수행한다.
   */
  async stats(ownerSub?: string): Promise<MeetingStatsDto> {
    const rows = await this.meetingRepository.find({
      where: ownerSub ? { ownerSub } : undefined,
      select: { status: true, startedAt: true, endedAt: true },
    });

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart);
      date.setDate(todayStart.getDate() - (6 - index));
      return { date: formatLocalDate(date), count: 0 };
    });
    const oldestStart = new Date(todayStart);
    oldestStart.setDate(todayStart.getDate() - 6);

    let recordingMeetings = 0;
    let processingMeetings = 0;
    let completedMeetings = 0;
    let totalTranscribedMs = 0;

    for (const row of rows) {
      if (row.status === MeetingStatus.RECORDING) recordingMeetings += 1;
      if (row.status === MeetingStatus.PROCESSING) processingMeetings += 1;
      if (row.status === MeetingStatus.COMPLETED) completedMeetings += 1;

      const startedAt = toDate(row.startedAt);
      const endedAt = toDate(row.endedAt);
      if (startedAt && endedAt) {
        const delta = endedAt.getTime() - startedAt.getTime();
        if (delta > 0) totalTranscribedMs += delta;
      }

      if (startedAt && startedAt >= oldestStart) {
        const dayStart = new Date(
          startedAt.getFullYear(),
          startedAt.getMonth(),
          startedAt.getDate(),
        );
        const diffDays = Math.round(
          (dayStart.getTime() - oldestStart.getTime()) / MS_PER_DAY,
        );
        if (diffDays >= 0 && diffDays < weekly.length) {
          weekly[diffDays].count += 1;
        }
      }
    }

    return {
      totalMeetings: rows.length,
      recordingMeetings,
      processingMeetings,
      completedMeetings,
      totalTranscribedSeconds: Math.round(totalTranscribedMs / 1000),
      weekly,
    };
  }

  /**
   * 사용자의 전체 회의 데이터를 노트·결과·전사 포함으로 직렬화합니다.
   * (설정 화면의 "전체 회의 내보내기(JSON)" 기능)
   */
  async exportAllData(ownerSub?: string): Promise<{
    exportedAt: string;
    meetingCount: number;
    meetings: Array<Record<string, unknown>>;
  }> {
    const meetings = await this.meetingRepository.find({
      where: ownerSub ? { ownerSub } : undefined,
      relations: ['note', 'result', 'transcripts'],
      order: { startedAt: 'DESC' },
    });

    return {
      exportedAt: new Date().toISOString(),
      meetingCount: meetings.length,
      meetings: meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        agenda: meeting.agenda,
        status: meeting.status,
        transcriptionMode: meeting.transcriptionMode,
        languageCode: meeting.languageCode,
        translateTargetLanguage: meeting.translateTargetLanguage,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        deletedAt: meeting.deletedAt,
        note: meeting.note
          ? {
              content: meeting.note.content,
              updatedAt: meeting.note.updatedAt,
            }
          : null,
        result: meeting.result
          ? {
              content: meeting.result.content,
              metadata: meeting.result.metadata,
              updatedAt: meeting.result.updatedAt,
            }
          : null,
        transcripts: (meeting.transcripts ?? [])
          .slice()
          .sort((a, b) => a.startTime - b.startTime)
          .map((segment) => ({
            startTime: segment.startTime,
            endTime: segment.endTime,
            text: segment.text,
            translatedText: segment.translatedText,
            speakerLabel: segment.speakerLabel,
            detectedLanguage: segment.detectedLanguage,
          })),
      })),
    };
  }

  async listTrash(
    query: ListMeetingsQueryDto,
    ownerSub?: string,
  ): Promise<{
    meetings: MeetingEntity[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const trashQuery = this.meetingRepository
      .createQueryBuilder('meeting')
      .withDeleted()
      .where('meeting.deletedAt IS NOT NULL');

    if (ownerSub) {
      trashQuery.andWhere('meeting.owner_sub = :ownerSub', { ownerSub });
    }

    const [meetings, total] = await trashQuery
      .orderBy('meeting.deletedAt', 'DESC')
      .offset(skip)
      .limit(limit)
      .getManyAndCount();

    return {
      meetings,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async search(
    query: SearchMeetingsQueryDto,
    ownerSub?: string,
  ): Promise<{
    results: MeetingSearchResult[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const keyword = query.q.trim();
    const scope = query.scope ?? 'all';
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    if (keyword.length === 0) {
      throw new BadRequestException('Search query must not be empty');
    }

    if (!SEARCH_SCOPES.includes(scope)) {
      throw new BadRequestException(`Unsupported search scope: ${scope}`);
    }

    const loweredKeyword = keyword.toLowerCase();
    try {
      const coverageComplete =
        await this.meetingSearchDocumentService.ensureCoverage(ownerSub);
      if (!coverageComplete) {
        this.logger.warn('meeting.search.projection_incomplete', {
          ownerSub,
          scope,
        });
        return this.searchLegacy({
          scope,
          keyword,
          loweredKeyword,
          page,
          limit,
          ownerSub,
        });
      }

      const { rows, total } = await this.meetingSearchDocumentService.search({
        loweredKeyword,
        scope,
        page,
        limit,
        ownerSub,
      });

      const results = rows.map((row) =>
        this.toSearchResultFromDocument({
          row,
          scope,
          keyword,
          loweredKeyword,
        }),
      );

      return {
        results,
        pagination: {
          page,
          limit,
          total,
        },
      };
    } catch (error) {
      this.logger.warn('meeting.search.projection_fallback', {
        ownerSub,
        scope,
        keywordLength: keyword.length,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return this.searchLegacy({
        scope,
        keyword,
        loweredKeyword,
        page,
        limit,
        ownerSub,
      });
    }
  }

  async findById(id: string, ownerSub?: string): Promise<MeetingEntity> {
    const meeting = await this.meetingRepository.findOne({
      where: ownerSub ? { id, ownerSub } : { id },
    });

    if (!meeting) {
      throw new NotFoundException({
        code: 'MEETING_NOT_FOUND',
        message: `Meeting ${id} not found`,
      });
    }

    return meeting;
  }

  async updatePrompt(
    id: string,
    dto: UpdateMeetingDto,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    const hasTitle = typeof dto.title === 'string';
    const hasPromptId = typeof dto.promptId === 'string';
    const hasTranscriptionMode = typeof dto.transcriptionMode === 'string';

    if (!hasTitle && !hasPromptId && !hasTranscriptionMode) {
      throw new BadRequestException(
        'At least one of title, promptId, or transcriptionMode must be provided',
      );
    }

    if (hasTitle) {
      meeting.title = (dto.title as string).trim() || meeting.title;
    }

    if (hasPromptId) {
      await this.promptService.ensureExists(dto.promptId as string, ownerSub);
      meeting.promptId = dto.promptId as string;
    }

    if (hasTranscriptionMode) {
      meeting.transcriptionMode =
        dto.transcriptionMode as MeetingTranscriptionMode;
    }

    const saved = await this.meetingRepository.save(meeting);

    // Sync title to result.metadata if title was changed and a result exists
    if (hasTitle) {
      const result = await this.resultRepository.findOne({
        where: { meetingId: id },
      });
      if (result && result.metadata?.title !== saved.title) {
        result.metadata = { ...result.metadata, title: saved.title };
        await this.resultRepository.save(result);
      }
    }

    return saved;
  }

  /**
   * AI가 제안한 제목은 사용자가 제목을 직접 입력하지 않은 경우에만 저장합니다.
   * WHERE 조건으로 제목 편집과 결과 생성의 경합에서도 수동 제목을 덮어쓰지 않습니다.
   */
  async setGeneratedTitleIfMissing(
    id: string,
    suggestedTitle: string | undefined,
  ): Promise<string | undefined> {
    const title = suggestedTitle?.trim().slice(0, 255);
    if (!title) return undefined;

    const updated = await this.meetingRepository
      .createQueryBuilder()
      .update(MeetingEntity)
      .set({ title })
      .where('id = :id', { id })
      .andWhere("(title IS NULL OR TRIM(title) = '')")
      .execute();

    if (!updated.affected) return undefined;

    await this.meetingSearchDocumentService.refreshByMeetingId(id);
    this.logger.log('meeting.generated_title.saved', { meetingId: id });
    return title;
  }

  async complete(
    id: string,
    options?: { skipTranscription?: boolean; markAttentionRequired?: boolean },
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);

    // 상태 전이 가드: 이미 종결된 회의를 다시 PROCESSING으로 되돌리지 않는다.
    // (이중 클릭, 두 탭, 프론트의 실패 후 재호출 등에서 COMPLETED가
    // PROCESSING으로 회귀하며 상태 플래그가 덮어써지는 문제 방지)
    if (meeting.status === MeetingStatus.COMPLETED) {
      this.logger.log('meeting.complete.idempotent_skip', {
        meetingId: meeting.id,
        ownerSub: meeting.ownerSub,
      });
      return meeting;
    }

    const skipTranscription = options?.skipTranscription ?? false;
    const markAttentionRequired = options?.markAttentionRequired ?? false;

    const isBatchWithTranscription =
      meeting.transcriptionMode === MeetingTranscriptionMode.BATCH &&
      !skipTranscription;

    // 배치 모드: PROCESSING (배치 전사 대기)
    // 실시간 모드: PROCESSING (AI 결과 생성 대기)
    // skipTranscription(전사 없음): COMPLETED
    if (isBatchWithTranscription) {
      const shouldGenerate = await this.isBatchTranscriptionSettled(meeting.id);
      const processingPhase = shouldGenerate
        ? MeetingProcessingPhase.GENERATING
        : MeetingProcessingPhase.UPLOADING;
      const updated = await this.updateLifecycle(
        meeting,
        {
          status: MeetingStatus.PROCESSING,
          processingPhase,
          needsAttention: false,
          completionState: null,
          endedAt: new Date(),
        },
        'meeting.completed.awaiting_upload',
      );
      this.logger.log('meeting.completed.awaiting_transcription', {
        meetingId: updated.id,
        ownerSub: updated.ownerSub,
        transcriptionMode: updated.transcriptionMode,
      });
      this.emitStatusChanged(
        updated.id,
        updated.status,
        processingPhase,
        updated.ownerSub,
        updated.needsAttention,
        updated.completionState,
      );
      return updated;
    }

    // 실시간 모드 또는 전사 없음 → PROCESSING 후 결과 생성 시 COMPLETED
    const updated = await this.updateLifecycle(
      meeting,
      {
        status: MeetingStatus.PROCESSING,
        processingPhase: MeetingProcessingPhase.GENERATING,
        needsAttention: meeting.needsAttention || markAttentionRequired,
        completionState: null,
        endedAt: new Date(),
      },
      'meeting.completed.awaiting_generation',
    );
    this.logger.log('meeting.completed.awaiting_generation', {
      meetingId: updated.id,
      ownerSub: updated.ownerSub,
      transcriptionMode: updated.transcriptionMode,
      skipTranscription,
      markAttentionRequired,
    });
    this.emitStatusChanged(
      updated.id,
      updated.status,
      MeetingProcessingPhase.GENERATING,
      updated.ownerSub,
      updated.needsAttention,
      updated.completionState,
    );
    return updated;
  }

  private async isBatchTranscriptionSettled(
    meetingId: string,
  ): Promise<boolean> {
    const [jobCount, unsettledJobCount, pendingUploadCount] = await Promise.all(
      [
        this.transcriptionJobRepository.count({ where: { meetingId } }),
        this.transcriptionJobRepository.count({
          where: unsettledTranscriptionJobWhere(meetingId),
        }),
        this.transcriptionUploadRepository.count({
          where: {
            meetingId,
            status: In([
              TranscriptionUploadStatus.ISSUED,
              TranscriptionUploadStatus.UPLOADED,
            ]),
          },
        }),
      ],
    );

    return jobCount > 0 && unsettledJobCount === 0 && pendingUploadCount === 0;
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    return this.updateLifecycleStatus(meeting, {
      status,
      processingPhase: status === MeetingStatus.COMPLETED ? null : undefined,
    });
  }

  async updateProcessingPhase(
    id: string,
    processingPhase: MeetingProcessingPhase | null,
    ownerSub?: string,
    options?: {
      needsAttention?: boolean;
      status?: MeetingStatus;
      completionState?: MeetingCompletionState | null;
    },
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    return this.updateLifecycleStatus(meeting, {
      status: options?.status,
      processingPhase,
      needsAttention: options?.needsAttention,
      completionState: options?.completionState,
    });
  }

  async markNeedsAttention(
    id: string,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    return this.updateLifecycleStatus(meeting, {
      needsAttention: true,
      processingPhase: null,
      completionState:
        meeting.status === MeetingStatus.COMPLETED
          ? MeetingCompletionState.ATTENTION_REQUIRED
          : undefined,
    });
  }

  async remove(id: string, ownerSub?: string): Promise<void> {
    const meeting = await this.findById(id, ownerSub);
    await this.meetingRepository.softRemove(meeting);
  }

  async restore(id: string, ownerSub?: string): Promise<void> {
    const meeting = await this.meetingRepository.findOne({
      where: ownerSub ? { id, ownerSub } : { id },
      withDeleted: true,
    });
    if (!meeting || !meeting.deletedAt) {
      throw new NotFoundException(`Meeting ${id} not found in trash`);
    }

    await this.meetingRepository.restore(id);
  }

  async purge(id: string, ownerSub?: string): Promise<void> {
    const meeting = await this.meetingRepository.findOne({
      where: ownerSub ? { id, ownerSub } : { id },
      withDeleted: true,
    });
    if (!meeting || !meeting.deletedAt) {
      throw new NotFoundException(`Meeting ${id} not found in trash`);
    }

    await this.meetingRepository.remove(meeting);
  }

  async bulkRemove(
    ids: string[],
    ownerSub?: string,
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const meeting = await this.meetingRepository.findOne({
          where: ownerSub ? { id, ownerSub } : { id },
        });
        if (!meeting) {
          failed.push(id);
          continue;
        }
        await this.meetingRepository.softRemove(meeting);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }

    return { succeeded, failed };
  }

  async bulkRestore(
    ids: string[],
    ownerSub?: string,
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const meeting = await this.meetingRepository.findOne({
          where: ownerSub ? { id, ownerSub } : { id },
          withDeleted: true,
        });
        if (!meeting || !meeting.deletedAt) {
          failed.push(id);
          continue;
        }
        await this.meetingRepository.restore(id);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }

    return { succeeded, failed };
  }

  async bulkPurge(
    ids: string[],
    ownerSub?: string,
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const meeting = await this.meetingRepository.findOne({
          where: ownerSub ? { id, ownerSub } : { id },
          withDeleted: true,
        });
        if (!meeting || !meeting.deletedAt) {
          failed.push(id);
          continue;
        }
        await this.meetingRepository.remove(meeting);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }

    return { succeeded, failed };
  }

  private async searchLegacy(params: {
    scope: SearchScope;
    keyword: string;
    loweredKeyword: string;
    page: number;
    limit: number;
    ownerSub?: string;
  }): Promise<{
    results: MeetingSearchResult[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const { scope, keyword, loweredKeyword, page, limit, ownerSub } = params;
    const skip = (page - 1) * limit;
    const likeKeyword = `%${loweredKeyword}%`;

    let total = 0;
    let pagedMeetings: MeetingEntity[] = [];

    if (scope === 'title') {
      const titleQuery = this.meetingRepository
        .createQueryBuilder('meeting')
        .where("LOWER(COALESCE(meeting.title, '')) LIKE :keyword", {
          keyword: likeKeyword,
        });
      if (ownerSub) {
        titleQuery.andWhere('meeting.owner_sub = :ownerSub', { ownerSub });
      }

      total = await titleQuery.clone().getCount();
      if (total > 0) {
        pagedMeetings = await titleQuery
          .clone()
          .orderBy('meeting.started_at', 'DESC')
          .offset(skip)
          .limit(limit)
          .getMany();
      }
    } else {
      const meetings = await this.meetingRepository.find({
        where: ownerSub ? { ownerSub } : undefined,
        relations: {
          note: true,
          result: true,
          transcripts: true,
        },
        order: { startedAt: 'DESC' },
      });

      const filtered = meetings.filter((meeting) =>
        this.matchesSearchScope(meeting, scope, loweredKeyword),
      );
      total = filtered.length;
      pagedMeetings = filtered.slice(skip, skip + limit);
    }

    return {
      results: pagedMeetings.map((meeting) =>
        this.toSearchResultFromMeeting({
          meeting,
          scope,
          keyword,
          loweredKeyword,
        }),
      ),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  private matchesSearchScope(
    meeting: MeetingEntity,
    scope: SearchScope,
    loweredKeyword: string,
  ): boolean {
    const title = meeting.title?.trim().toLowerCase() ?? '';
    const resultContent = meeting.result?.content?.trim().toLowerCase() ?? '';
    const noteContent = meeting.note?.content?.trim().toLowerCase() ?? '';
    const transcriptContent = (meeting.transcripts ?? [])
      .map((segment) => segment.text?.trim().toLowerCase() ?? '')
      .join(' ');

    switch (scope) {
      case 'title':
        return title.includes(loweredKeyword);
      case 'result':
        return resultContent.includes(loweredKeyword);
      case 'note':
        return noteContent.includes(loweredKeyword);
      case 'transcript':
        return transcriptContent.includes(loweredKeyword);
      case 'all':
      default:
        return (
          title.includes(loweredKeyword) ||
          resultContent.includes(loweredKeyword) ||
          noteContent.includes(loweredKeyword) ||
          transcriptContent.includes(loweredKeyword)
        );
    }
  }

  private toSearchResultFromMeeting(params: {
    meeting: MeetingEntity;
    scope: SearchScope;
    keyword: string;
    loweredKeyword: string;
  }): MeetingSearchResult {
    const { meeting, scope, keyword, loweredKeyword } = params;

    const title = meeting.title?.trim() ?? '';
    const resultContent = meeting.result?.content?.trim() ?? '';
    const noteContent = meeting.note?.content?.trim() ?? '';
    const transcriptContent = this.pickTranscriptContentFromMeeting(
      meeting,
      loweredKeyword,
    );

    const candidateOrder: Array<{
      matchedIn: SearchMatchedIn;
      content: string;
    }> =
      scope === 'all'
        ? [
            { matchedIn: 'title', content: title },
            { matchedIn: 'result', content: resultContent },
            { matchedIn: 'note', content: noteContent },
            { matchedIn: 'transcript', content: transcriptContent },
          ]
        : [
            {
              matchedIn: scope as SearchMatchedIn,
              content:
                scope === 'title'
                  ? title
                  : scope === 'result'
                    ? resultContent
                    : scope === 'note'
                      ? noteContent
                      : transcriptContent,
            },
          ];

    const matched =
      candidateOrder.find((candidate) =>
        candidate.content.toLowerCase().includes(loweredKeyword),
      ) ??
      candidateOrder.find((candidate) => candidate.content.length > 0) ??
      ({ matchedIn: 'title', content: title || keyword } as const);

    return {
      meetingId: meeting.id,
      title: meeting.title,
      status: meeting.status,
      processingPhase: meeting.processingPhase,
      needsAttention: meeting.needsAttention,
      completionState: meeting.completionState,
      transcriptionMode: meeting.transcriptionMode,
      matchedIn: matched.matchedIn,
      snippet: this.buildSnippet(matched.content, loweredKeyword) || keyword,
      startedAt: meeting.startedAt,
    };
  }

  private toSearchResultFromDocument(params: {
    row: MeetingSearchDocumentRow;
    scope: SearchScope;
    keyword: string;
    loweredKeyword: string;
  }): MeetingSearchResult {
    const { row, scope, keyword, loweredKeyword } = params;

    const title = row.title?.trim() ?? '';
    const resultContent = row.resultContent?.trim() ?? '';
    const noteContent = row.noteContent?.trim() ?? '';
    const transcriptContent = this.pickTranscriptContentFromDocument(
      row.transcriptContent ?? '',
      loweredKeyword,
    );

    const candidateOrder: Array<{
      matchedIn: SearchMatchedIn;
      content: string;
    }> =
      scope === 'all'
        ? [
            { matchedIn: 'title', content: title },
            { matchedIn: 'result', content: resultContent },
            { matchedIn: 'note', content: noteContent },
            { matchedIn: 'transcript', content: transcriptContent },
          ]
        : [
            {
              matchedIn: scope as SearchMatchedIn,
              content:
                scope === 'title'
                  ? title
                  : scope === 'result'
                    ? resultContent
                    : scope === 'note'
                      ? noteContent
                      : transcriptContent,
            },
          ];

    const matched =
      candidateOrder.find((candidate) =>
        candidate.content.toLowerCase().includes(loweredKeyword),
      ) ??
      candidateOrder.find((candidate) => candidate.content.length > 0) ??
      ({ matchedIn: 'title', content: title || keyword } as const);

    return {
      meetingId: row.meetingId,
      title: row.title,
      status: row.status as MeetingStatus,
      processingPhase: row.processingPhase ?? null,
      needsAttention: Boolean(row.needsAttention),
      completionState: row.completionState ?? null,
      transcriptionMode: row.transcriptionMode as MeetingTranscriptionMode,
      matchedIn: matched.matchedIn,
      snippet: this.buildSnippet(matched.content, loweredKeyword) || keyword,
      startedAt: new Date(row.startedAt),
    };
  }

  private pickTranscriptContentFromDocument(
    transcriptContent: string,
    loweredKeyword: string,
  ): string {
    const texts = transcriptContent
      .split('\n')
      .map((text) => text.trim())
      .filter((text) => text.length > 0);

    const matched = texts.find((text) =>
      text.toLowerCase().includes(loweredKeyword),
    );

    return matched ?? texts[0] ?? '';
  }

  private pickTranscriptContentFromMeeting(
    meeting: MeetingEntity,
    loweredKeyword: string,
  ): string {
    const texts = (meeting.transcripts ?? [])
      .map((segment) => segment.text?.trim() ?? '')
      .filter((text) => text.length > 0);

    const matched = texts.find((text) =>
      text.toLowerCase().includes(loweredKeyword),
    );

    return matched ?? texts[0] ?? '';
  }

  private buildSnippet(content: string, loweredKeyword: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    const maxLength = 220;
    const matchIndex = normalized.toLowerCase().indexOf(loweredKeyword);
    if (matchIndex < 0) {
      return normalized.slice(0, maxLength);
    }

    const radius = 90;
    const start = Math.max(0, matchIndex - radius);
    const end = Math.min(
      normalized.length,
      matchIndex + loweredKeyword.length + radius,
    );
    const prefix = start > 0 ? '...' : '';
    const suffix = end < normalized.length ? '...' : '';

    return `${prefix}${normalized.slice(start, end)}${suffix}`;
  }

  private emitStatusChanged(
    meetingId: string,
    status: MeetingStatus,
    phase?: MeetingStatusPhase,
    ownerSub?: string,
    needsAttention?: boolean,
    completionState?: MeetingCompletionState | null,
  ): void {
    this.eventEmitter.emit(
      MeetingStatusChangedEvent.EVENT_NAME,
      new MeetingStatusChangedEvent(
        meetingId,
        status,
        phase,
        ownerSub,
        needsAttention,
        completionState,
      ),
    );
  }

  private async updateLifecycleStatus(
    meeting: MeetingEntity,
    next: {
      status?: MeetingStatus;
      processingPhase?: MeetingProcessingPhase | null;
      needsAttention?: boolean;
      completionState?: MeetingCompletionState | null;
    },
  ): Promise<MeetingEntity> {
    const updated = await this.updateLifecycle(
      meeting,
      next,
      'meeting.status.updated',
    );
    this.emitStatusChanged(
      updated.id,
      updated.status,
      updated.status === MeetingStatus.COMPLETED
        ? 'completed'
        : (updated.processingPhase ?? undefined),
      updated.ownerSub,
      updated.needsAttention,
      updated.completionState,
    );
    return updated;
  }

  private async updateLifecycle(
    meeting: MeetingEntity,
    next: {
      status?: MeetingStatus;
      processingPhase?: MeetingProcessingPhase | null;
      needsAttention?: boolean;
      completionState?: MeetingCompletionState | null;
      endedAt?: Date;
    },
    logEvent: string,
  ): Promise<MeetingEntity> {
    if (next.status !== undefined) {
      meeting.status = next.status;
    }
    if (next.processingPhase !== undefined) {
      meeting.processingPhase = next.processingPhase;
    }
    if (next.needsAttention !== undefined) {
      meeting.needsAttention = next.needsAttention;
    }
    if (next.completionState !== undefined) {
      meeting.completionState = next.completionState;
    }
    if (next.endedAt !== undefined) {
      meeting.endedAt = next.endedAt;
    }
    const updated = await this.meetingRepository.save(meeting);
    this.logger.log(logEvent, {
      meetingId: updated.id,
      ownerSub: updated.ownerSub,
      status: updated.status,
      processingPhase: updated.processingPhase,
      needsAttention: updated.needsAttention,
      completionState: updated.completionState,
    });
    return updated;
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
