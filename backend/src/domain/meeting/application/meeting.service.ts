import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
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
  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
    private readonly promptService: PromptService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateMeetingDto): Promise<MeetingEntity> {
    const promptId = dto.promptId || DEFAULT_PROMPT_ID;
    const transcriptionMode =
      dto.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
    await this.promptService.ensureExists(promptId);

    const meeting = this.meetingRepository.create({
      title: dto.title?.trim() || undefined,
      agenda: dto.agenda?.trim() || undefined,
      promptId,
      status: MeetingStatus.RECORDING,
      transcriptionMode,
      languageCode: dto.languageCode?.trim() || undefined,
      translateTargetLanguage: dto.translateTargetLanguage?.trim() || undefined,
      startedAt: new Date(),
    });

    return this.meetingRepository.save(meeting);
  }

  async list(query: ListMeetingsQueryDto): Promise<{
    meetings: MeetingEntity[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [meetings, total] = await this.meetingRepository.findAndCount({
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

  async listTrash(query: ListMeetingsQueryDto): Promise<{
    meetings: MeetingEntity[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [meetings, total] = await this.meetingRepository
      .createQueryBuilder('meeting')
      .withDeleted()
      .where('meeting.deletedAt IS NOT NULL')
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

  async search(query: SearchMeetingsQueryDto): Promise<{
    results: MeetingSearchResult[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const keyword = query.q.trim();
    const scope = query.scope ?? 'all';
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    if (keyword.length === 0) {
      throw new BadRequestException('Search query must not be empty');
    }

    if (!SEARCH_SCOPES.includes(scope)) {
      throw new BadRequestException(`Unsupported search scope: ${scope}`);
    }

    const loweredKeyword = keyword.toLowerCase();
    const likeKeyword = `%${loweredKeyword}%`;

    let total = 0;
    let pagedMeetings: MeetingEntity[] = [];

    if (scope === 'title') {
      const titleQuery = this.meetingRepository
        .createQueryBuilder('meeting')
        .where("LOWER(COALESCE(meeting.title, '')) LIKE :keyword", {
          keyword: likeKeyword,
        });

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
      // 암호화된 컬럼(result/note/transcript)은 DB LIKE 검색이 불가능하므로
      // 복호화된 엔티티 로드 후 애플리케이션 레벨에서 필터링합니다.
      const meetings = await this.meetingRepository.find({
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

    const results = pagedMeetings.map((meeting) =>
      this.toSearchResult({
        meeting,
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
  }

  async findById(id: string): Promise<MeetingEntity> {
    const meeting = await this.meetingRepository.findOne({
      where: { id },
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
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id);
    const hasPromptId = typeof dto.promptId === 'string';
    const hasTranscriptionMode = typeof dto.transcriptionMode === 'string';

    if (!hasPromptId && !hasTranscriptionMode) {
      throw new BadRequestException(
        'Either promptId or transcriptionMode must be provided',
      );
    }

    if (hasPromptId) {
      await this.promptService.ensureExists(dto.promptId as string);
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
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id);
    const skipTranscription = options?.skipTranscription ?? false;

    const shouldProcessBatch =
      meeting.transcriptionMode === MeetingTranscriptionMode.BATCH &&
      !skipTranscription;

    meeting.status = shouldProcessBatch
      ? MeetingStatus.PROCESSING
      : MeetingStatus.COMPLETED;
    meeting.endedAt = new Date();
    const updated = await this.meetingRepository.save(meeting);
    this.emitStatusChanged(
      updated.id,
      updated.status,
      shouldProcessBatch ? 'transcribing' : 'completed',
    );
    return updated;
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
  ): Promise<MeetingEntity> {
    const meeting = await this.findById(id);
    meeting.status = status;
    const updated = await this.meetingRepository.save(meeting);
    this.emitStatusChanged(
      updated.id,
      updated.status,
      status === MeetingStatus.COMPLETED ? 'completed' : undefined,
    );
    return updated;
  }

  async remove(id: string): Promise<void> {
    const meeting = await this.findById(id);
    await this.meetingRepository.softRemove(meeting);
  }

  async restore(id: string): Promise<void> {
    const meeting = await this.meetingRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!meeting || !meeting.deletedAt) {
      throw new NotFoundException(`Meeting ${id} not found in trash`);
    }

    await this.meetingRepository.restore(id);
  }

  async purge(id: string): Promise<void> {
    const meeting = await this.meetingRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!meeting || !meeting.deletedAt) {
      throw new NotFoundException(`Meeting ${id} not found in trash`);
    }

    await this.meetingRepository.remove(meeting);
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

  private toSearchResult(params: {
    meeting: MeetingEntity;
    scope: SearchScope;
    keyword: string;
    loweredKeyword: string;
  }): MeetingSearchResult {
    const { meeting, scope, keyword, loweredKeyword } = params;

    const title = meeting.title?.trim() ?? '';
    const resultContent = meeting.result?.content?.trim() ?? '';
    const noteContent = meeting.note?.content?.trim() ?? '';
    const transcriptContent = this.pickTranscriptContent(
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

  private pickTranscriptContent(
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
  ): void {
    this.eventEmitter.emit(
      MeetingStatusChangedEvent.EVENT_NAME,
      new MeetingStatusChangedEvent(meetingId, status, phase),
    );
  }
}
