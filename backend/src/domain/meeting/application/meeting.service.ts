import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { MeetingStatus } from '../domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../domain/meeting-transcription-mode.enum';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { SearchMeetingsQueryDto } from './dto/search-meetings-query.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

const DEFAULT_PROMPT_ID = 'prompt_default_meeting';
const SEARCH_SCOPES = ['all', 'title', 'result', 'transcript', 'note'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];
export type SearchMatchedIn = Exclude<SearchScope, 'all'>;

export interface MeetingSearchResult {
  meetingId: string;
  title?: string;
  status: MeetingStatus;
  transcriptionMode: MeetingTranscriptionMode;
  matchedIn: SearchMatchedIn;
  snippet: string;
  startedAt: Date;
}

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
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
      await this.meetingSearchDocumentService.ensureCoverage();

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
      this.logger.warn(
        `Search projection unavailable, falling back to legacy search: ${error instanceof Error ? error.message : error}`,
      );
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

    return this.meetingRepository.save(meeting);
  }

  async complete(
    id: string,
    options?: { skipTranscription?: boolean },
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    const skipTranscription = options?.skipTranscription ?? false;

    const isBatchWithTranscription =
      meeting.transcriptionMode === MeetingTranscriptionMode.BATCH &&
      !skipTranscription;

    // 배치 모드: PROCESSING (배치 전사 대기)
    // 실시간 모드: PROCESSING (AI 결과 생성 대기)
    // skipTranscription(전사 없음): COMPLETED
    if (isBatchWithTranscription) {
      meeting.status = MeetingStatus.PROCESSING;
      meeting.endedAt = new Date();
      const updated = await this.meetingRepository.save(meeting);
      this.emitStatusChanged(
        updated.id,
        updated.status,
        'transcribing',
        updated.ownerSub,
      );
      return updated;
    }

    // 실시간 모드 또는 전사 없음 → PROCESSING 후 결과 생성 시 COMPLETED
    meeting.status = MeetingStatus.PROCESSING;
    meeting.endedAt = new Date();
    const updated = await this.meetingRepository.save(meeting);
    this.emitStatusChanged(
      updated.id,
      updated.status,
      'generating',
      updated.ownerSub,
    );
    return updated;
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id, ownerSub);
    meeting.status = status;
    const updated = await this.meetingRepository.save(meeting);
    this.emitStatusChanged(
      updated.id,
      updated.status,
      status === MeetingStatus.COMPLETED ? 'completed' : undefined,
      updated.ownerSub,
    );
    return updated;
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
  ): void {
    this.eventEmitter.emit(
      MeetingStatusChangedEvent.EVENT_NAME,
      new MeetingStatusChangedEvent(meetingId, status, phase, ownerSub),
    );
  }
}
