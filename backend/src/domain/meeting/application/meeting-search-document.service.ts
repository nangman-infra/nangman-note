import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoteEntity } from '../../note/domain/note.entity';
import { ResultEntity } from '../../result/domain/result.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingSearchDocumentEntity } from '../domain/meeting-search-document.entity';

const MAX_TRANSCRIPT_CONTENT_LENGTH = 40_000;
const MAX_NOTE_CONTENT_LENGTH = 20_000;
const MAX_RESULT_CONTENT_LENGTH = 20_000;

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
  transcriptionMode: string;
  startedAt: Date;
}

@Injectable()
export class MeetingSearchDocumentService {
  private readonly logger = new Logger(MeetingSearchDocumentService.name);

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
      this.logger.warn(
        `Failed to refresh search document for meeting ${meetingId}: ${error instanceof Error ? error.message : error}`,
      );
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
        this.logger.warn(
          `Failed to backfill search document for meeting ${row.id}: ${error instanceof Error ? error.message : error}`,
        );
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
