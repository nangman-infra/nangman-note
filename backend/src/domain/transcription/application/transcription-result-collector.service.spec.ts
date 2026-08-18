import { DataSource, EntityManager, Repository } from 'typeorm';
import { ResultService } from '../../result/application/result.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingProcessingPhase } from '../../meeting/domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';

describe('TranscriptionResultCollectorService', () => {
  let service: TranscriptionResultCollectorService;
  let jobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'findOne' | 'save' | 'count'>
  >;
  let segmentRepository: jest.Mocked<
    Pick<Repository<TranscriptSegmentEntity>, 'create'>
  >;
  let dataSource: DataSource;
  let transactionManager: jest.Mocked<
    Pick<EntityManager, 'delete' | 'save' | 'find'>
  >;
  let batchProvider: jest.Mocked<
    Pick<BatchTranscriptionProvider, 'getJobStatus'>
  >;
  let meetingService: jest.Mocked<
    Pick<
      MeetingService,
      | 'findById'
      | 'updateStatus'
      | 'updateProcessingPhase'
      | 'markNeedsAttention'
    >
  >;
  let resultService: jest.Mocked<Pick<ResultService, 'generateForPipeline'>>;
  let s3AudioService: jest.Mocked<
    Pick<S3AudioService, 'getObjectAsStringFromBucket' | 'deleteAudioFile'>
  >;
  let uploadRepository: jest.Mocked<
    Pick<Repository<TranscriptionUploadEntity>, 'find'>
  >;

  const buildJob = (
    overrides: Partial<TranscriptionJobEntity> = {},
  ): TranscriptionJobEntity =>
    ({
      id: 'job-1',
      meetingId: 'meeting-1',
      provider: 'aws-transcribe' as TranscriptionJobEntity['provider'],
      providerJobId: 'aws-job-1',
      status: TranscriptionJobStatus.QUEUED,
      mediaUri: 's3://audio-bucket/meeting-1/audio.webm',
      languageCode: 'ko-KR',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as TranscriptionJobEntity;

  beforeEach(() => {
    jobRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    segmentRepository = {
      create: jest.fn(),
    };
    transactionManager = {
      delete: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    dataSource = {
      options: { type: 'sqljs' },
      transaction: jest.fn(
        async (task: (entityManager: EntityManager) => Promise<unknown>) =>
          task(transactionManager as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    batchProvider = {
      getJobStatus: jest.fn(),
    };
    meetingService = {
      findById: jest.fn().mockResolvedValue({
        id: 'meeting-1',
        ownerSub: 'user-1',
      } as never),
      updateStatus: jest.fn(),
      updateProcessingPhase: jest.fn().mockResolvedValue({
        id: 'meeting-1',
        processingPhase: MeetingProcessingPhase.GENERATING,
        needsAttention: false,
      } as never),
      markNeedsAttention: jest.fn().mockResolvedValue({
        id: 'meeting-1',
        needsAttention: true,
      } as never),
    };
    resultService = {
      generateForPipeline: jest.fn(),
    };
    s3AudioService = {
      getObjectAsStringFromBucket: jest.fn(),
      deleteAudioFile: jest.fn(),
    };

    uploadRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    service = new TranscriptionResultCollectorService(
      jobRepository as unknown as Repository<TranscriptionJobEntity>,
      segmentRepository as unknown as Repository<TranscriptSegmentEntity>,
      uploadRepository as unknown as Repository<TranscriptionUploadEntity>,
      batchProvider as unknown as BatchTranscriptionProvider,
      meetingService as unknown as MeetingService,
      resultService as unknown as ResultService,
      s3AudioService as unknown as S3AudioService,
      dataSource,
    );
  });

  it('returns failure when transcription job does not exist', async () => {
    jobRepository.findOne.mockResolvedValue(null);

    const result = await service.pollAndCollect('meeting-1', 'missing-job');

    expect(result).toEqual({ success: false, segmentCount: 0 });
    expect(batchProvider.getJobStatus.mock.calls).toHaveLength(0);
  });

  it('skips collection when a job was already collected', async () => {
    jobRepository.findOne.mockResolvedValue(
      buildJob({
        status: TranscriptionJobStatus.COMPLETED,
        collectedAt: new Date('2026-03-01T00:05:00.000Z'),
      }),
    );

    const result = await service.pollAndCollect('meeting-1', 'job-1');

    expect(result).toEqual({ success: true, segmentCount: 0 });
    expect(batchProvider.getJobStatus).not.toHaveBeenCalled();
    expect(transactionManager.delete).not.toHaveBeenCalled();
    expect(transactionManager.save).not.toHaveBeenCalled();
    expect(s3AudioService.deleteAudioFile).not.toHaveBeenCalled();
  });

  it('collects completed batch transcription and finalizes meeting', async () => {
    const job = buildJob();
    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptionJobEntity),
    );
    batchProvider.getJobStatus.mockResolvedValue({
      status: TranscriptionJobStatus.COMPLETED,
      transcriptUri: 's3://transcript-bucket/meeting-1/result.json',
    });
    s3AudioService.getObjectAsStringFromBucket.mockResolvedValue(
      JSON.stringify({
        results: {
          items: [
            {
              type: 'pronunciation',
              start_time: '0.0',
              end_time: '1.0',
              alternatives: [{ confidence: '0.9', content: '안녕' }],
            },
            {
              type: 'punctuation',
              alternatives: [{ content: '.' }],
            },
            {
              type: 'pronunciation',
              start_time: '1.1',
              end_time: '2.0',
              alternatives: [{ confidence: '0.8', content: '테스트' }],
            },
          ],
        },
      }),
    );
    segmentRepository.create.mockImplementation(
      (entity) => entity as TranscriptSegmentEntity,
    );
    transactionManager.save.mockImplementation((_target, entity) =>
      Promise.resolve(entity as TranscriptSegmentEntity),
    );
    meetingService.updateStatus.mockResolvedValue({} as never);
    resultService.generateForPipeline.mockResolvedValue({} as never);
    s3AudioService.deleteAudioFile.mockResolvedValue(undefined);

    const result = await service.pollAndCollect('meeting-1', 'job-1');

    expect(result).toEqual({ success: true, segmentCount: 2 });
    expect(jobRepository.save.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(transactionManager.delete).toHaveBeenCalledWith(
      TranscriptSegmentEntity,
      {
        meetingId: 'meeting-1',
        transcriptionJobId: 'job-1',
      },
    );
    expect(transactionManager.save).toHaveBeenCalledTimes(1);
    expect(s3AudioService.deleteAudioFile).toHaveBeenCalledWith(
      'meeting-1/audio.webm',
    );
    expect(meetingService.updateStatus).not.toHaveBeenCalled();
    expect(resultService.generateForPipeline).not.toHaveBeenCalled();
    expect(meetingService.markNeedsAttention).not.toHaveBeenCalled();
    expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
      'meeting-1',
      MeetingProcessingPhase.GENERATING,
      'user-1',
      expect.objectContaining({
        status: MeetingStatus.PROCESSING,
      }),
    );
  });

  it('handles failed transcription by finalizing meeting safely', async () => {
    const job = buildJob();
    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptionJobEntity),
    );
    batchProvider.getJobStatus.mockResolvedValue({
      status: TranscriptionJobStatus.FAILED,
      errorMessage: 'provider failed',
    });
    s3AudioService.deleteAudioFile.mockResolvedValue(undefined);
    meetingService.updateStatus.mockResolvedValue({} as never);
    resultService.generateForPipeline.mockResolvedValue({} as never);

    const result = await service.pollAndCollect('meeting-1', 'job-1');

    expect(result).toEqual({ success: false, segmentCount: 0 });
    // 실패 시 원본 오디오는 보존한다 (재시도 가능성 유지)
    expect(s3AudioService.deleteAudioFile).not.toHaveBeenCalled();
    expect(meetingService.updateStatus).not.toHaveBeenCalled();
    expect(resultService.generateForPipeline).not.toHaveBeenCalled();
    expect(meetingService.markNeedsAttention).toHaveBeenCalledWith(
      'meeting-1',
      'user-1',
    );
    expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
      'meeting-1',
      MeetingProcessingPhase.GENERATING,
      'user-1',
      expect.objectContaining({
        status: MeetingStatus.PROCESSING,
      }),
    );
  });

  it('generates result and updates meeting status on generating phase event', async () => {
    resultService.generateForPipeline.mockResolvedValue({} as never);
    meetingService.updateStatus.mockResolvedValue({} as never);

    await service.handleGeneratingPhase({
      meetingId: 'meeting-1',
      status: MeetingStatus.PROCESSING,
      phase: MeetingProcessingPhase.GENERATING,
    } as never);

    expect(resultService.generateForPipeline).toHaveBeenCalledWith('meeting-1');
    expect(meetingService.updateStatus).toHaveBeenCalledWith(
      'meeting-1',
      MeetingStatus.COMPLETED,
    );
  });

  it('recovers stale queued jobs by collecting transcripts before generating', async () => {
    const job = buildJob({
      status: TranscriptionJobStatus.PROCESSING,
    });
    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptionJobEntity),
    );
    batchProvider.getJobStatus.mockResolvedValue({
      status: TranscriptionJobStatus.COMPLETED,
      transcriptUri: 's3://transcript-bucket/meeting-1/result.json',
    });
    s3AudioService.getObjectAsStringFromBucket.mockResolvedValue(
      JSON.stringify({
        results: {
          items: [
            {
              type: 'pronunciation',
              start_time: '0.0',
              end_time: '1.0',
              alternatives: [{ confidence: '0.9', content: '안녕' }],
            },
          ],
        },
      }),
    );
    segmentRepository.create.mockImplementation(
      (entity) => entity as TranscriptSegmentEntity,
    );
    transactionManager.save.mockImplementation((_target, entity) =>
      Promise.resolve(entity as TranscriptSegmentEntity),
    );
    s3AudioService.deleteAudioFile.mockResolvedValue(undefined);

    const result = await service.recoverStalledBatchJob(
      'meeting-1',
      'job-1',
      'user-1',
    );

    expect(result).toEqual({ success: true, segmentCount: 1 });
    expect(transactionManager.delete).toHaveBeenCalledWith(
      TranscriptSegmentEntity,
      {
        meetingId: 'meeting-1',
        transcriptionJobId: 'job-1',
      },
    );
    expect(transactionManager.save).toHaveBeenCalledTimes(1);
    expect(meetingService.markNeedsAttention).not.toHaveBeenCalled();
    expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
      'meeting-1',
      MeetingProcessingPhase.GENERATING,
      'user-1',
      expect.objectContaining({
        status: MeetingStatus.PROCESSING,
      }),
    );
  });

  it('marks stale jobs failed and falls back to generating when provider remains stuck past job lifetime', async () => {
    const job = buildJob({
      status: TranscriptionJobStatus.PROCESSING,
      // 잡 수명(6시간)을 초과한 오래된 잡
      createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    });
    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptionJobEntity),
    );
    batchProvider.getJobStatus.mockResolvedValue({
      status: TranscriptionJobStatus.PROCESSING,
    });
    s3AudioService.deleteAudioFile.mockResolvedValue(undefined);

    const result = await service.recoverStalledBatchJob(
      'meeting-1',
      'job-1',
      'user-1',
    );

    expect(result).toEqual({ success: false, segmentCount: 0 });
    expect(jobRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: TranscriptionJobStatus.FAILED,
        errorMessage: 'Batch transcription did not finish within 6h',
      }),
    );
    // 최종 실패여도 원본 오디오는 보존
    expect(s3AudioService.deleteAudioFile).not.toHaveBeenCalled();
    expect(meetingService.markNeedsAttention).toHaveBeenCalledWith(
      'meeting-1',
      'user-1',
    );
    expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
      'meeting-1',
      MeetingProcessingPhase.GENERATING,
      'user-1',
      expect.objectContaining({
        status: MeetingStatus.PROCESSING,
      }),
    );
  });

  it('resumes polling instead of failing when provider is still processing within job lifetime', async () => {
    const job = buildJob({
      status: TranscriptionJobStatus.PROCESSING,
      // 최근 생성된 잡 (수명 이내)
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    });
    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptionJobEntity),
    );
    batchProvider.getJobStatus.mockResolvedValue({
      status: TranscriptionJobStatus.PROCESSING,
    });
    const pollSpy = jest
      .spyOn(service, 'pollAndCollect')
      .mockResolvedValue({ success: true, segmentCount: 0 });

    const result = await service.recoverStalledBatchJob(
      'meeting-1',
      'job-1',
      'user-1',
    );

    expect(result).toEqual({ success: false, segmentCount: 0 });
    expect(pollSpy).toHaveBeenCalledWith('meeting-1', 'job-1');
    // 진행 중인 잡은 실패로 마킹하지 않는다
    expect(jobRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: TranscriptionJobStatus.FAILED }),
    );
    expect(meetingService.markNeedsAttention).not.toHaveBeenCalled();
    expect(s3AudioService.deleteAudioFile).not.toHaveBeenCalled();
  });

  it('still marks meeting completed when result generation fails on generating phase', async () => {
    resultService.generateForPipeline.mockRejectedValue(
      new Error('generation failed'),
    );
    meetingService.updateStatus.mockResolvedValue({} as never);

    await service.handleGeneratingPhase({
      meetingId: 'meeting-1',
      status: MeetingStatus.PROCESSING,
      phase: MeetingProcessingPhase.GENERATING,
    } as never);

    expect(meetingService.updateStatus).toHaveBeenCalledWith(
      'meeting-1',
      MeetingStatus.COMPLETED,
    );
  });
});
