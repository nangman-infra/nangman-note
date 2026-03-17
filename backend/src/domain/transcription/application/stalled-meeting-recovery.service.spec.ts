import { DataSource, Repository } from 'typeorm';
import { ResultEntity } from '../../result/domain/result.entity';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { StalledMeetingRecoveryService } from './stalled-meeting-recovery.service';
import { TranscriptionService } from './transcription.service';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';

describe('StalledMeetingRecoveryService', () => {
  let service: StalledMeetingRecoveryService;
  let meetingRepository: jest.Mocked<Pick<Repository<MeetingEntity>, 'find'>>;
  let resultRepository: jest.Mocked<
    Pick<Repository<ResultEntity>, 'findOne'>
  >;
  let transcriptionJobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'findOne'>
  >;
  let transcriptionUploadRepository: jest.Mocked<
    Pick<Repository<TranscriptionUploadEntity>, 'findOne'>
  >;
  let meetingService: jest.Mocked<Pick<MeetingService, 'updateStatus'>>;
  let transcriptionService: jest.Mocked<
    Pick<TranscriptionService, 'recoverPendingBatchUpload'>
  >;
  let transcriptionResultCollectorService: jest.Mocked<
    Pick<
      TranscriptionResultCollectorService,
      'recoverMissingBatchJob' | 'recoverStalledBatchJob'
    >
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'options' | 'query'>>;

  const now = new Date('2026-03-13T12:00:00.000Z');

  const buildMeeting = (
    overrides: Partial<MeetingEntity> = {},
  ): MeetingEntity =>
    ({
      id: 'meeting-1',
      ownerSub: 'user-1',
      status: MeetingStatus.PROCESSING,
      transcriptionMode: MeetingTranscriptionMode.BATCH,
      startedAt: new Date('2026-03-13T09:00:00.000Z'),
      endedAt: new Date('2026-03-13T10:30:00.000Z'),
      createdAt: new Date('2026-03-13T09:00:00.000Z'),
      updatedAt: new Date('2026-03-13T10:30:00.000Z'),
      ...overrides,
    }) as MeetingEntity;

  const buildJob = (
    overrides: Partial<TranscriptionJobEntity> = {},
  ): TranscriptionJobEntity =>
    ({
      id: 'job-1',
      meetingId: 'meeting-1',
      providerJobId: 'provider-job-1',
      status: TranscriptionJobStatus.QUEUED,
      mediaUri: 's3://bucket/audio.wav',
      languageCode: 'ko-KR',
      createdAt: new Date('2026-03-13T10:30:00.000Z'),
      updatedAt: new Date('2026-03-13T10:30:00.000Z'),
      ...overrides,
    }) as TranscriptionJobEntity;

  const buildUpload = (
    overrides: Partial<TranscriptionUploadEntity> = {},
  ): TranscriptionUploadEntity =>
    ({
      id: 'upload-1',
      meetingId: 'meeting-1',
      bucket: 'bucket',
      s3Key: 'audio/meeting-1/file.webm',
      mediaUri: 's3://bucket/audio/meeting-1/file.webm',
      status: TranscriptionUploadStatus.ISSUED,
      contentType: 'audio/webm',
      createdAt: new Date('2026-03-13T10:30:00.000Z'),
      updatedAt: new Date('2026-03-13T10:30:00.000Z'),
      ...overrides,
    }) as TranscriptionUploadEntity;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    meetingRepository = {
      find: jest.fn(),
    };
    resultRepository = {
      findOne: jest.fn(),
    };
    transcriptionJobRepository = {
      findOne: jest.fn(),
    };
    transcriptionUploadRepository = {
      findOne: jest.fn(),
    };
    meetingService = {
      updateStatus: jest.fn(),
    };
    transcriptionService = {
      recoverPendingBatchUpload: jest.fn(),
    };
    transcriptionResultCollectorService = {
      recoverMissingBatchJob: jest.fn(),
      recoverStalledBatchJob: jest.fn(),
    };
    dataSource = {
      options: { type: 'sqlite' } as DataSource['options'],
      query: jest.fn(),
    };

    service = new StalledMeetingRecoveryService(
      meetingRepository as unknown as Repository<MeetingEntity>,
      resultRepository as unknown as Repository<ResultEntity>,
      transcriptionJobRepository as unknown as Repository<TranscriptionJobEntity>,
      transcriptionUploadRepository as unknown as Repository<TranscriptionUploadEntity>,
      meetingService as unknown as MeetingService,
      transcriptionService as unknown as TranscriptionService,
      transcriptionResultCollectorService as unknown as TranscriptionResultCollectorService,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('recovers stale meetings without transcription jobs via missing-job path', async () => {
    meetingRepository.find.mockResolvedValue([buildMeeting()]);
    resultRepository.findOne.mockResolvedValue(null);
    transcriptionJobRepository.findOne.mockResolvedValue(null);
    transcriptionUploadRepository.findOne.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(
      transcriptionResultCollectorService.recoverMissingBatchJob,
    ).toHaveBeenCalledWith('meeting-1', 'user-1');
  });

  it('recovers stale meetings through the latest upload session when no job exists', async () => {
    meetingRepository.find.mockResolvedValue([buildMeeting()]);
    resultRepository.findOne.mockResolvedValue(null);
    transcriptionJobRepository.findOne.mockResolvedValue(null);
    transcriptionUploadRepository.findOne.mockResolvedValue(buildUpload());
    transcriptionService.recoverPendingBatchUpload.mockResolvedValue({
      queued: true,
      objectPresent: true,
      jobId: 'job-1',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(transcriptionService.recoverPendingBatchUpload).toHaveBeenCalledWith(
      'meeting-1',
      'upload-1',
      'user-1',
    );
    expect(
      transcriptionResultCollectorService.recoverMissingBatchJob,
    ).not.toHaveBeenCalled();
  });

  it('falls back to missing-job recovery when uploaded object is still missing', async () => {
    meetingRepository.find.mockResolvedValue([buildMeeting()]);
    resultRepository.findOne.mockResolvedValue(null);
    transcriptionJobRepository.findOne.mockResolvedValue(null);
    transcriptionUploadRepository.findOne.mockResolvedValue(buildUpload());
    transcriptionService.recoverPendingBatchUpload.mockResolvedValue({
      queued: false,
      objectPresent: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(
      transcriptionResultCollectorService.recoverMissingBatchJob,
    ).toHaveBeenCalledWith('meeting-1', 'user-1');
  });

  it('marks meetings completed when a result already exists', async () => {
    meetingRepository.find.mockResolvedValue([buildMeeting()]);
    resultRepository.findOne.mockResolvedValue({
      id: 'result-1',
      meetingId: 'meeting-1',
    } as ResultEntity);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(meetingService.updateStatus).toHaveBeenCalledWith(
      'meeting-1',
      MeetingStatus.COMPLETED,
    );
    expect(
      transcriptionResultCollectorService.recoverMissingBatchJob,
    ).not.toHaveBeenCalled();
    expect(
      transcriptionResultCollectorService.recoverStalledBatchJob,
    ).not.toHaveBeenCalled();
  });

  it('skips fresh queued jobs that are still within the threshold', async () => {
    meetingRepository.find.mockResolvedValue([
      buildMeeting({
        endedAt: new Date('2026-03-13T11:20:00.000Z'),
      }),
    ]);
    resultRepository.findOne.mockResolvedValue(null);
    transcriptionJobRepository.findOne.mockResolvedValue(
      buildJob({
        updatedAt: new Date('2026-03-13T11:25:00.000Z'),
      }),
    );
    transcriptionUploadRepository.findOne.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(
      transcriptionResultCollectorService.recoverStalledBatchJob,
    ).not.toHaveBeenCalled();
  });

  it('recovers stale queued or processing jobs through the collector', async () => {
    meetingRepository.find.mockResolvedValue([buildMeeting()]);
    resultRepository.findOne.mockResolvedValue(null);
    transcriptionJobRepository.findOne.mockResolvedValue(
      buildJob({
        status: TranscriptionJobStatus.PROCESSING,
        updatedAt: new Date('2026-03-13T10:40:00.000Z'),
      }),
    );
    transcriptionUploadRepository.findOne.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(
      transcriptionResultCollectorService.recoverStalledBatchJob,
    ).toHaveBeenCalledWith('meeting-1', 'job-1', 'user-1');
  });

  it('uses a Postgres advisory lock when available', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.options as any).type = 'postgres';
    dataSource.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([]);
    meetingRepository.find.mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).recoverStalledMeetings();

    expect(dataSource.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock($1) AS locked',
      [74274001],
    );
    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock($1)',
      [74274001],
    );
  });
});
