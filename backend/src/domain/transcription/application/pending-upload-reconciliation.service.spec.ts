/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { DataSource, QueryRunner, Repository } from 'typeorm';
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
    Pick<
      TranscriptionService,
      'reconcilePendingBatchUpload' | 'recoverPendingBatchUpload'
    >
  >;
  let dataSource: jest.Mocked<
    Pick<DataSource, 'options' | 'createQueryRunner'>
  >;
  let queryRunner: jest.Mocked<
    Pick<QueryRunner, 'connect' | 'query' | 'release'>
  >;

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
      recoverPendingBatchUpload: jest.fn().mockResolvedValue({
        queued: false,
        objectPresent: false,
      }),
    };
    queryRunner = {
      connect: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
    };
    dataSource = {
      options: { type: 'sqlite' } as DataSource['options'],
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
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

    expect(
      transcriptionService.reconcilePendingBatchUpload,
    ).toHaveBeenCalledWith('meeting-1', 'upload-1', 'user-1');
  });

  it('finalizes an expired issued upload through the recovery path', async () => {
    const createdAt = new Date(Date.now() - 60_000);
    transcriptionUploadRepository.find.mockResolvedValue([
      {
        id: 'upload-expired',
        meetingId: 'meeting-1',
        status: TranscriptionUploadStatus.ISSUED,
        expiresAt: new Date(Date.now() - 1),
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

    expect(transcriptionService.recoverPendingBatchUpload).toHaveBeenCalledWith(
      'meeting-1',
      'upload-expired',
      'user-1',
    );
    expect(
      transcriptionService.reconcilePendingBatchUpload,
    ).not.toHaveBeenCalled();
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

  it('unlocks and releases the same QueryRunner when reconciliation fails', async () => {
    (dataSource.options as { type: string }).type = 'postgres';
    queryRunner.query.mockResolvedValueOnce([{ locked: true }]);
    transcriptionUploadRepository.find.mockRejectedValue(
      new Error('db failed'),
    );

    await expect((service as any).reconcilePendingUploads()).rejects.toThrow(
      'db failed',
    );

    expect(queryRunner.connect).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock($1) AS locked',
      [74274002],
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock($1)',
      [74274002],
    );
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
