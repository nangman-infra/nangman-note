import { In, IsNull, Like, type FindOptionsWhere } from 'typeorm';
import { TranscriptionJobEntity } from './transcription-job.entity';
import { TranscriptionJobStatus } from './transcription-job-status.enum';

export const TRANSCRIPTION_COLLECTION_FAILURE_PREFIX =
  'Result collection failed: ';

export const TRANSCRIPTION_SUBMISSION_PENDING_ERROR =
  'AWS transcription submission pending';

export function unsettledTranscriptionJobWhere(
  meetingId: string,
): FindOptionsWhere<TranscriptionJobEntity>[] {
  return [
    {
      meetingId,
      status: In([
        TranscriptionJobStatus.QUEUED,
        TranscriptionJobStatus.PROCESSING,
      ]),
    },
    {
      meetingId,
      status: TranscriptionJobStatus.COMPLETED,
      collectedAt: IsNull(),
    },
    {
      meetingId,
      status: TranscriptionJobStatus.FAILED,
      errorMessage: Like(`${TRANSCRIPTION_COLLECTION_FAILURE_PREFIX}%`),
    },
  ];
}
