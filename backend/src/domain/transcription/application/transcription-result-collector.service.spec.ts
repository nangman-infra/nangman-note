import { Repository } from 'typeorm';
import { ResultService } from '../../result/application/result.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';

describe('TranscriptionResultCollectorService', () => {
  let service: TranscriptionResultCollectorService;
  let jobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'findOne' | 'save'>
  >;
  let segmentRepository: jest.Mocked<
    Pick<Repository<TranscriptSegmentEntity>, 'create' | 'save'>
  >;
  let batchProvider: jest.Mocked<
    Pick<BatchTranscriptionProvider, 'getJobStatus'>
  >;
  let meetingService: jest.Mocked<
    Pick<MeetingService, 'findById' | 'updateStatus'>
  >;
  let resultService: jest.Mocked<Pick<ResultService, 'generateForPipeline'>>;
  let s3AudioService: jest.Mocked<
    Pick<S3AudioService, 'getObjectAsStringFromBucket' | 'deleteAudioFile'>
  >;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

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
    };
    segmentRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    batchProvider = {
      getJobStatus: jest.fn(),
    };
    meetingService = {
      findById: jest.fn().mockResolvedValue({
        id: 'meeting-1',
        ownerSub: 'user-1',
      }),
      updateStatus: jest.fn(),
    };
    resultService = {
      generateForPipeline: jest.fn(),
    };
    s3AudioService = {
      getObjectAsStringFromBucket: jest.fn(),
      deleteAudioFile: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    service = new TranscriptionResultCollectorService(
      jobRepository as unknown as Repository<TranscriptionJobEntity>,
      segmentRepository as unknown as Repository<TranscriptSegmentEntity>,
      batchProvider as unknown as BatchTranscriptionProvider,
      meetingService as unknown as MeetingService,
      resultService as unknown as ResultService,
      s3AudioService as unknown as S3AudioService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('returns failure when transcription job does not exist', async () => {
    jobRepository.findOne.mockResolvedValue(null);

    const result = await service.pollAndCollect('meeting-1', 'missing-job');

    expect(result).toEqual({ success: false, segmentCount: 0 });
    expect(batchProvider.getJobStatus.mock.calls).toHaveLength(0);
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
    segmentRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity as TranscriptSegmentEntity),
    );
    meetingService.updateStatus.mockResolvedValue({} as never);
    resultService.generateForPipeline.mockResolvedValue({} as never);
    s3AudioService.deleteAudioFile.mockResolvedValue(undefined);

    const result = await service.pollAndCollect('meeting-1', 'job-1');

    expect(result).toEqual({ success: true, segmentCount: 2 });
    expect(jobRepository.save.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(segmentRepository.save).toHaveBeenCalledTimes(1);
    expect(s3AudioService.deleteAudioFile).toHaveBeenCalledWith(
      'meeting-1/audio.webm',
    );
    expect(meetingService.updateStatus).not.toHaveBeenCalled();
    expect(resultService.generateForPipeline).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'meeting.status.changed',
      expect.objectContaining({
        meetingId: 'meeting-1',
        status: MeetingStatus.PROCESSING,
        phase: 'generating',
        ownerSub: 'user-1',
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
    expect(s3AudioService.deleteAudioFile).toHaveBeenCalledWith(
      'meeting-1/audio.webm',
    );
    expect(meetingService.updateStatus).not.toHaveBeenCalled();
    expect(resultService.generateForPipeline).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'meeting.status.changed',
      expect.objectContaining({
        meetingId: 'meeting-1',
        status: MeetingStatus.PROCESSING,
        phase: 'generating',
        ownerSub: 'user-1',
      }),
    );
  });

  it('generates result and updates meeting status on generating phase event', async () => {
    resultService.generateForPipeline.mockResolvedValue({} as never);
    meetingService.updateStatus.mockResolvedValue({} as never);

    await service.handleGeneratingPhase({
      meetingId: 'meeting-1',
      status: MeetingStatus.PROCESSING,
      phase: 'generating',
    } as never);

    expect(resultService.generateForPipeline).toHaveBeenCalledWith('meeting-1');
    expect(meetingService.updateStatus).toHaveBeenCalledWith(
      'meeting-1',
      MeetingStatus.COMPLETED,
    );
  });

  it('still marks meeting completed when result generation fails on generating phase', async () => {
    resultService.generateForPipeline.mockRejectedValue(
      new Error('generation failed'),
    );
    meetingService.updateStatus.mockResolvedValue({} as never);

    await service.handleGeneratingPhase({
      meetingId: 'meeting-1',
      status: MeetingStatus.PROCESSING,
      phase: 'generating',
    } as never);

    expect(meetingService.updateStatus).toHaveBeenCalledWith(
      'meeting-1',
      MeetingStatus.COMPLETED,
    );
  });
});
