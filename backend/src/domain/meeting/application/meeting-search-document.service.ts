import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async refreshByMeetingId(meetingId: string): Promise<void> {
    try {
      const meeting = await this.meetingRepository.findOne({
        where: { id: meetingId },
        withDeleted: true,
      });

      if (!meeting || meeting.deletedAt) {
        await this.searchDocumentRepository.delete({ meetingId });
        return;
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
        return;
      }

      await this.searchDocumentRepository.save(
        this.searchDocumentRepository.create(nextPayload),
      );
    } catch (error) {
      this.logger.warn('meeting.search_document.refresh_failed', {
        meetingId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async ensureCoverage(limit = 200): Promise<number> {
    const missingRows = await this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoin(
        MeetingSearchDocumentEntity,
        'doc',
        'doc.meeting_id = meeting.id',
      )
      .select('meeting.id', 'id')
      .where('meeting.deleted_at IS NULL')
      .andWhere('doc.meeting_id IS NULL')
      .orderBy('meeting.started_at', 'DESC')
      .limit(Math.max(1, limit))
      .getRawMany<{ id: string }>();

    for (const row of missingRows) {
      try {
        await this.refreshByMeetingId(row.id);
      } catch (error) {
        this.logger.warn('meeting.search_document.backfill_failed', {
          meetingId: row.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return missingRows.length;
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
    const keyword = `%${loweredKeyword}%`;

    const query = this.searchDocumentRepository
      .createQueryBuilder('doc')
      .innerJoin(MeetingEntity, 'meeting', 'meeting.id = doc.meeting_id')
      .where('meeting.deleted_at IS NULL');

    if (ownerSub) {
      query.andWhere('doc.owner_sub = :ownerSub', { ownerSub });
    }

    if (scope === 'title') {
      query.andWhere("LOWER(COALESCE(doc.title, '')) LIKE :keyword", {
        keyword,
      });
    } else if (scope === 'result') {
      query.andWhere("LOWER(COALESCE(doc.result_content, '')) LIKE :keyword", {
        keyword,
      });
    } else if (scope === 'note') {
      query.andWhere("LOWER(COALESCE(doc.note_content, '')) LIKE :keyword", {
        keyword,
      });
    } else if (scope === 'transcript') {
      query.andWhere(
        "LOWER(COALESCE(doc.transcript_content, '')) LIKE :keyword",
        {
          keyword,
        },
      );
    } else {
      query.andWhere(
        `
          LOWER(COALESCE(doc.title, '')) LIKE :keyword
          OR LOWER(COALESCE(doc.result_content, '')) LIKE :keyword
          OR LOWER(COALESCE(doc.note_content, '')) LIKE :keyword
          OR LOWER(COALESCE(doc.transcript_content, '')) LIKE :keyword
        `,
        { keyword },
      );
    }

    const total = await query.clone().getCount();
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const rows = await query
      .clone()
      .select([
        'doc.meeting_id AS "meetingId"',
        'doc.owner_sub AS "ownerSub"',
        'doc.title AS "title"',
        'doc.note_content AS "noteContent"',
        'doc.result_content AS "resultContent"',
        'doc.transcript_content AS "transcriptContent"',
        'meeting.status AS "status"',
        'meeting.processing_phase AS "processingPhase"',
        'meeting.needs_attention AS "needsAttention"',
        'meeting.completion_state AS "completionState"',
        'meeting.transcription_mode AS "transcriptionMode"',
        'meeting.started_at AS "startedAt"',
      ])
      .orderBy('meeting.started_at', 'DESC')
      .offset(skip)
      .limit(limit)
      .getRawMany<MeetingSearchDocumentRow>();

    return { rows, total };
  }

  private limitText(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return normalized.slice(0, maxLength);
  }
}
