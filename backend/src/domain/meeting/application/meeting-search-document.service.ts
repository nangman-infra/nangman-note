import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NoteEntity } from '../../note/domain/note.entity';
import { ResultEntity } from '../../result/domain/result.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { MeetingCompletionState } from '../domain/meeting-completion-state.enum';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingSearchDocumentEntity } from '../domain/meeting-search-document.entity';
import { MeetingProcessingPhase } from '../domain/meeting-processing-phase.enum';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

// 장시간 회의 후반부도 검색 가능하도록 충분히 크게 설정
// (3시간 회의 전사 ≈ 10만~15만 자; text 컬럼이라 스키마 제약 없음)
const MAX_TRANSCRIPT_CONTENT_LENGTH = 200_000;
const MAX_NOTE_CONTENT_LENGTH = 100_000;
const MAX_RESULT_CONTENT_LENGTH = 100_000;

export type MeetingSearchScope =
  | 'all'
  | 'title'
  | 'result'
  | 'transcript'
  | 'note';

export interface MeetingSearchDocumentRow {
  meetingId: string;
  ownerSub?: string;
  title: string;
  noteContent: string;
  resultContent: string;
  transcriptContent: string;
  status: string;
  processingPhase?: MeetingProcessingPhase | null;
  needsAttention: boolean;
  completionState?: MeetingCompletionState | null;
  transcriptionMode: string;
  startedAt: Date;
}

@Injectable()
export class MeetingSearchDocumentService {
  private readonly logger = new StructuredLogger(
    MeetingSearchDocumentService.name,
  );

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
    @InjectRepository(MeetingSearchDocumentEntity)
    private readonly searchDocumentRepository: Repository<MeetingSearchDocumentEntity>,
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
  ) {}

  async refreshByMeetingId(meetingId: string): Promise<boolean> {
    try {
      const meeting = await this.meetingRepository.findOne({
        where: { id: meetingId },
        withDeleted: true,
      });

      if (!meeting || meeting.deletedAt) {
        await this.searchDocumentRepository.delete({ meetingId });
        return true;
      }

      const [note, result, transcripts, existing] = await Promise.all([
        this.noteRepository.findOne({
          where: { meetingId },
        }),
        this.resultRepository.findOne({
          where: { meetingId },
        }),
        this.transcriptRepository.find({
          where: { meetingId },
          order: { startTime: 'ASC' },
        }),
        this.searchDocumentRepository.findOne({
          where: { meetingId },
        }),
      ]);

      const nextPayload: Omit<
        MeetingSearchDocumentEntity,
        'meeting' | 'updatedAt'
      > = {
        meetingId,
        ownerSub: meeting.ownerSub,
        title: (meeting.title ?? '').trim(),
        noteContent: this.limitText(
          note?.content ?? '',
          MAX_NOTE_CONTENT_LENGTH,
        ),
        resultContent: this.limitText(
          result?.content ?? '',
          MAX_RESULT_CONTENT_LENGTH,
        ),
        transcriptContent: this.limitText(
          transcripts.map((segment) => segment.text ?? '').join('\n'),
          MAX_TRANSCRIPT_CONTENT_LENGTH,
        ),
      };

      if (existing) {
        existing.ownerSub = nextPayload.ownerSub;
        existing.title = nextPayload.title;
        existing.noteContent = nextPayload.noteContent;
        existing.resultContent = nextPayload.resultContent;
        existing.transcriptContent = nextPayload.transcriptContent;
        await this.searchDocumentRepository.save(existing);
        return true;
      }

      await this.searchDocumentRepository.save(
        this.searchDocumentRepository.create(nextPayload),
      );
      return true;
    } catch (error) {
      this.logger.warn('meeting.search_document.refresh_failed', {
        meetingId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      try {
        await this.searchDocumentRepository.delete({ meetingId });
      } catch (cleanupError) {
        this.logger.warn('meeting.search_document.invalidate_failed', {
          meetingId,
          errorMessage:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }
      return false;
    }
  }

  async ensureCoverage(ownerSub?: string, limit = 200): Promise<boolean> {
    const batchSize = Math.max(1, limit);
    const missingRows = await this.findMissingMeetingIds(
      ownerSub,
      batchSize + 1,
    );
    let refreshSucceeded = true;

    for (const row of missingRows.slice(0, batchSize)) {
      const refreshed = await this.refreshByMeetingId(row.id);
      refreshSucceeded = refreshed && refreshSucceeded;
    }

    if (!refreshSucceeded || missingRows.length > batchSize) {
      return false;
    }

    return (await this.findMissingMeetingIds(ownerSub, 1)).length === 0;
  }

  private async findMissingMeetingIds(
    ownerSub: string | undefined,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    const query = this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoin(
        MeetingSearchDocumentEntity,
        'doc',
        `doc.meeting_id = meeting.id
          AND COALESCE(doc.owner_sub, '') = COALESCE(meeting.owner_sub, '')`,
      )
      .select('meeting.id', 'id')
      .where('meeting.deleted_at IS NULL')
      .andWhere('doc.meeting_id IS NULL');

    if (ownerSub) {
      query.andWhere('meeting.owner_sub = :ownerSub', { ownerSub });
    }

    return query
      .orderBy('meeting.started_at', 'DESC')
      .limit(limit)
      .getRawMany<{ id: string }>();
  }

  async search(params: {
    loweredKeyword: string;
    scope: MeetingSearchScope;
    page: number;
    limit: number;
    ownerSub?: string;
  }): Promise<{ rows: MeetingSearchDocumentRow[]; total: number }> {
    const { loweredKeyword, scope, page, limit, ownerSub } = params;
    const skip = (page - 1) * limit;
    // AES-GCM ciphertext is intentionally non-searchable. Load the encrypted
    // projection through TypeORM so the subscriber decrypts it before matching.
    const documents = await this.searchDocumentRepository.find({
      where: {
        ...(ownerSub ? { ownerSub } : {}),
        meeting: { deletedAt: IsNull() },
      },
      relations: { meeting: true },
      select: {
        meetingId: true,
        ownerSub: true,
        title: true,
        noteContent: scope === 'all' || scope === 'note',
        resultContent: scope === 'all' || scope === 'result',
        transcriptContent: scope === 'all' || scope === 'transcript',
        meeting: {
          id: true,
          status: true,
          processingPhase: true,
          needsAttention: true,
          completionState: true,
          transcriptionMode: true,
          startedAt: true,
        },
      },
      order: { meeting: { startedAt: 'DESC' } },
    });
    const matchedDocuments = documents.filter((document) =>
      this.matchesKeyword(document, loweredKeyword, scope),
    );
    const total = matchedDocuments.length;
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const rows = matchedDocuments.slice(skip, skip + limit).map((document) => ({
      meetingId: document.meetingId,
      ownerSub: document.ownerSub,
      title: document.title,
      noteContent: document.noteContent ?? '',
      resultContent: document.resultContent ?? '',
      transcriptContent: document.transcriptContent ?? '',
      status: document.meeting.status,
      processingPhase: document.meeting.processingPhase,
      needsAttention: document.meeting.needsAttention,
      completionState: document.meeting.completionState,
      transcriptionMode: document.meeting.transcriptionMode,
      startedAt: document.meeting.startedAt,
    }));

    return { rows, total };
  }

  private matchesKeyword(
    document: MeetingSearchDocumentEntity,
    loweredKeyword: string,
    scope: MeetingSearchScope,
  ): boolean {
    const fields: Record<Exclude<MeetingSearchScope, 'all'>, string> = {
      title: document.title ?? '',
      result: document.resultContent ?? '',
      transcript: document.transcriptContent ?? '',
      note: document.noteContent ?? '',
    };

    if (scope !== 'all') {
      return fields[scope].toLowerCase().includes(loweredKeyword);
    }

    return Object.values(fields).some((value) =>
      value.toLowerCase().includes(loweredKeyword),
    );
  }

  private limitText(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return normalized.slice(0, maxLength);
  }
}
