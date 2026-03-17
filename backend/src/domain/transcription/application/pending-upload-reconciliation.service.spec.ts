import { DataSource, Repository } from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { PendingUploadReconciliationService } from './pending-upload-reconciliation.service';
import { TranscriptionService } from './transcription.service';

describe('PendingUploadReconciliationService', () => {
  let service: PendingUploadReconciliationService;
  let transcriptionUploadRepository: jest.Mocked<
    Pick<Repository<TranscriptionUploadEntity>, 'find'>
  >;
  let transcriptionService: jest.Mocked<
    Pick<TranscriptionService, 'reconcilePendingBatchUpload'>
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'options' | 'query'>>;

  beforeEach(() => {
    transcriptionUploadRepository = {
      find: jest.fn(),
    };
    transcriptionService = {
      reconcilePendingBatchUpload: jest.fn().mockResolvedValue({
        queued: true,
        objectPresent: true,
        jobId: 'job-1',
      }),
    };
    dataSource = {
      options: { type: 'sqlite' } as DataSource['options'],
      query: jest.fn(),
    };

    service = new PendingUploadReconciliationService(
      transcriptionUploadRepository as unknown as Repository<TranscriptionUploadEntity>,
      transcriptionService as unknown as TranscriptionService,
      dataSource as unknown as DataSource,
    );
  });

  it('reconciles aged issued uploads for processing batch meetings', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    transcriptionUploadRepository.find.mockResolvedValue([
      {
        id: 'upload-1',
        meetingId: 'meeting-1',
        status: TranscriptionUploadStatus.ISSUED,
        createdAt,
        updatedAt: createdAt,
        meeting: {
          id: 'meeting-1',
          ownerSub: 'user-1',
          status: MeetingStatus.PROCESSING,
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        } as MeetingEntity,
      } as TranscriptionUploadEntity,
    ]);

    await (service as any).reconcilePendingUploads();

    expect(transcriptionService.reconcilePendingBatchUpload).toHaveBeenCalledWith(
      'meeting-1',
      'upload-1',
      'user-1',
    );
  });

  it('skips uploads for completed meetings', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    transcriptionUploadRepository.find.mockResolvedValue([
      {
        id: 'upload-1',
        meetingId: 'meeting-1',
        status: TranscriptionUploadStatus.ISSUED,
        createdAt,
        updatedAt: createdAt,
        meeting: {
          id: 'meeting-1',
          ownerSub: 'user-1',
          status: MeetingStatus.COMPLETED,
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        } as MeetingEntity,
      } as TranscriptionUploadEntity,
    ]);

    await (service as any).reconcilePendingUploads();

    expect(
      transcriptionService.reconcilePendingBatchUpload,
    ).not.toHaveBeenCalled();
  });
});
