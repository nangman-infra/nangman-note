import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobProvider } from '../domain/transcription-job-provider.enum';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import type { StreamingTranscriptionProvider } from './ports/streaming-transcription-provider.port';
import type { TranslationProvider } from './ports/translation-provider.port';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';
import {
  type RealtimeTranscriptContentPayload,
  type RealtimeTranscriptPayload,
  TranscriptionService,
} from './transcription.service';

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let transcriptRepository: jest.Mocked<
    Pick<
      Repository<TranscriptSegmentEntity>,
      'find' | 'findOne' | 'create' | 'save'
    >
  >;
  let transcriptionJobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'find' | 'findOne' | 'create' | 'save'>
  >;
  let transcriptionUploadRepository: jest.Mocked<
    Pick<Repository<TranscriptionUploadEntity>, 'findOne' | 'create' | 'save'>
  >;
  let meetingService: jest.Mocked<
    Pick<
      MeetingService,
      'findById' | 'updatePrompt' | 'updateProcessingPhase' | 'markNeedsAttention'
    >
  >;
  let batchTranscriptionProvider: jest.Mocked<BatchTranscriptionProvider>;
  let streamingProvider: jest.Mocked<StreamingTranscriptionProvider>;
  let translationProvider: jest.Mocked<
    Pick<TranslationProvider, 'translateText' | 'isSameLanguage'>
  >;
  let transcriptionResultCollectorService: jest.Mocked<
    Pick<TranscriptionResultCollectorService, 'pollAndCollect'>
  >;
  let s3AudioService: jest.Mocked<
    Pick<
      S3AudioService,
      | 'generateUploadUrl'
      | 'objectExists'
      | 'objectExistsForMediaUri'
      | 'isManagedMediaUri'
    >
  >;

  const buildMeeting = (
    overrides: Partial<MeetingEntity> = {},
  ): MeetingEntity =>
    ({
      id: 'meeting-1',
      promptId: 'prompt_default_meeting',
      status: MeetingStatus.RECORDING,
      transcriptionMode: MeetingTranscriptionMode.BATCH,
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as MeetingEntity;

  const buildJob = (
    overrides: Partial<TranscriptionJobEntity> = {},
  ): TranscriptionJobEntity =>
    ({
      id: 'job-1',
      meetingId: 'meeting-1',
      provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
      providerJobId: 'aws-job-1',
      status: TranscriptionJobStatus.QUEUED,
      mediaUri: 's3://bucket/audio.wav',
      languageCode: 'ko-KR',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
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
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as TranscriptionUploadEntity;

  beforeEach(() => {
    transcriptRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    transcriptionJobRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    transcriptionUploadRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    meetingService = {
      findById: jest.fn(),
      updatePrompt: jest.fn(),
      updateProcessingPhase: jest.fn(),
      markNeedsAttention: jest.fn(),
    };
    batchTranscriptionProvider = {
      submitBatchJob: jest.fn(),
      getJobStatus: jest.fn(),
    };
    streamingProvider = {
      startSession: jest.fn(),
      feedAudio: jest.fn().mockReturnValue(true),
      stopSession: jest.fn(),
      hasActiveSession: jest.fn().mockReturnValue(false),
      isSessionReady: jest.fn().mockReturnValue(false),
      getActiveSessionCount: jest.fn().mockReturnValue(0),
    };
    translationProvider = {
      translateText: jest.fn(),
      isSameLanguage: jest.fn().mockReturnValue(false),
    };
    transcriptionResultCollectorService = {
      pollAndCollect: jest.fn().mockResolvedValue({
        success: true,
        segmentCount: 0,
      }),
    };
    s3AudioService = {
      generateUploadUrl: jest.fn(),
      objectExists: jest.fn().mockResolvedValue(true),
      objectExistsForMediaUri: jest.fn().mockResolvedValue(true),
      isManagedMediaUri: jest.fn().mockReturnValue(true),
    };

    service = new TranscriptionService(
      transcriptRepository as unknown as Repository<TranscriptSegmentEntity>,
      transcriptionJobRepository as unknown as Repository<TranscriptionJobEntity>,
      transcriptionUploadRepository as unknown as Repository<TranscriptionUploadEntity>,
      meetingService as unknown as MeetingService,
      batchTranscriptionProvider,
      streamingProvider,
      translationProvider,
      transcriptionResultCollectorService as unknown as TranscriptionResultCollectorService,
      s3AudioService as unknown as S3AudioService,
    );
  });

  describe('listByMeetingId', () => {
    it('returns transcript segments sorted by startTime', async () => {
      const meeting = buildMeeting();
      meetingService.findById.mockResolvedValue(meeting);
      transcriptRepository.find.mockResolvedValue([
        { id: 'segment-1' } as TranscriptSegmentEntity,
      ]);

      const segments = await service.listByMeetingId('meeting-1');

      expect(meetingService.findById).toHaveBeenCalledWith(
        'meeting-1',
        undefined,
      );
      expect(transcriptRepository.find).toHaveBeenCalledWith({
        where: { meetingId: 'meeting-1' },
        order: { startTime: 'ASC' },
      });
      expect(segments).toHaveLength(1);
    });
  });

  describe('acceptRealtimeAudioChunk', () => {
    it('accepts payload when realtime mode is enabled', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.REALTIME }),
      );

      await expect(
        service.acceptRealtimeAudioChunk(
          'meeting-1',
          new Uint8Array([1, 2, 3]),
        ),
      ).resolves.toBe(true);

      expect(streamingProvider.feedAudio.mock.calls).toHaveLength(1);
    });
  });

  describe('feedRealtimeAudio', () => {
    it('returns false when provider rejects chunk because of backpressure', () => {
      streamingProvider.feedAudio.mockReturnValue(false);

      const ok = service.feedRealtimeAudio('meeting-1', Buffer.from([1, 2, 3]));

      expect(ok).toBe(false);
    });
  });

  describe('realtime session counters', () => {
    it('returns active session count from provider', () => {
      streamingProvider.getActiveSessionCount.mockReturnValue(7);

      expect(service.getActiveRealtimeSessionCount()).toBe(7);
    });

    it('returns realtime session readiness from provider', () => {
      streamingProvider.isSessionReady.mockReturnValue(true);

      expect(service.isRealtimeSessionReady('meeting-1')).toBe(true);
    });
  });

  describe('switchMeetingToBatchFallback', () => {
    it('switches realtime meeting to batch mode', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.REALTIME }),
      );
      meetingService.updatePrompt.mockResolvedValue(buildMeeting());

      const switched = await service.switchMeetingToBatchFallback('meeting-1');

      expect(switched).toBe(true);
      expect(meetingService.updatePrompt).toHaveBeenCalledWith(
        'meeting-1',
        {
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        },
        undefined,
      );
    });

    it('returns false when meeting is already batch mode', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.BATCH }),
      );

      const switched = await service.switchMeetingToBatchFallback('meeting-1');

      expect(switched).toBe(false);
      expect(meetingService.updatePrompt).not.toHaveBeenCalled();
    });
  });

  describe('ensureRealtimeEnabled', () => {
    it('throws when meeting transcription mode is not realtime', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.BATCH }),
      );

      await expect(
        service.ensureRealtimeEnabled('meeting-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('realtime translation flow', () => {
    it('emits final immediately and sends translation update later', async () => {
      const payloads: RealtimeTranscriptPayload[] = [];

      let onTranscriptHandler:
        | ((event: {
            type: 'partial' | 'final';
            resultId: string;
            text: string;
            startTime: number;
            endTime: number;
            detectedLanguage?: string;
          }) => void)
        | undefined;

      meetingService.findById.mockResolvedValue(
        buildMeeting({
          transcriptionMode: MeetingTranscriptionMode.REALTIME,
          translateTargetLanguage: 'en',
        }),
      );

      streamingProvider.startSession.mockImplementation((options) => {
        onTranscriptHandler = options.onTranscript;
        return Promise.resolve();
      });

      const deferredTranslate = new Promise<{
        translatedText: string;
        sourceLanguageCode: string;
        targetLanguageCode: string;
      }>((resolve) => {
        setTimeout(() => {
          resolve({
            translatedText: 'hello team',
            sourceLanguageCode: 'ko',
            targetLanguageCode: 'en',
          });
        }, 0);
      });

      translationProvider.isSameLanguage.mockReturnValue(false);
      translationProvider.translateText.mockReturnValue(deferredTranslate);

      transcriptRepository.create.mockImplementation(
        (entity) => entity as TranscriptSegmentEntity,
      );
      transcriptRepository.save
        .mockResolvedValueOnce({
          id: 'segment-1',
        } as TranscriptSegmentEntity)
        .mockResolvedValueOnce({
          id: 'segment-1',
          translatedText: 'hello team',
        } as TranscriptSegmentEntity);

      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      expect(onTranscriptHandler).toBeDefined();
      onTranscriptHandler?.({
        type: 'final',
        resultId: 'result-1',
        text: '안녕하세요 팀',
        startTime: 0,
        endTime: 1.5,
        detectedLanguage: 'ko-KR',
      });

      // final은 번역 완료를 기다리지 않고 즉시 전달
      expect(payloads[0]).toMatchObject({
        type: 'final',
        resultId: 'result-1',
        text: '안녕하세요 팀',
        translationPending: true,
      });

      await deferredTranslate;
      await Promise.resolve();

      expect(payloads).toContainEqual(
        expect.objectContaining({
          type: 'translation',
          resultId: 'result-1',
          translatedText: 'hello team',
        }),
      );

      expect(transcriptRepository.create).toHaveBeenCalledWith({
        id: 'segment-1',
        translatedText: 'hello team',
      });
      expect(transcriptRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: 'segment-1',
          translatedText: 'hello team',
        }),
      );
    });
  });

  describe('realtime session reconnect offset', () => {
    it('applies DB offset on first session start and in-memory offset on reconnect', async () => {
      const payloads: RealtimeTranscriptPayload[] = [];

      let onTranscriptHandler:
        | ((event: {
            type: 'partial' | 'final';
            resultId: string;
            text: string;
            startTime: number;
            endTime: number;
          }) => void)
        | undefined;

      meetingService.findById.mockResolvedValue(
        buildMeeting({
          transcriptionMode: MeetingTranscriptionMode.REALTIME,
        }),
      );

      streamingProvider.startSession.mockImplementation((options) => {
        onTranscriptHandler = options.onTranscript;
        return Promise.resolve();
      });

      transcriptRepository.create.mockImplementation(
        (entity) => entity as TranscriptSegmentEntity,
      );
      transcriptRepository.save.mockImplementation((entity) =>
        Promise.resolve({ id: 'seg-1', ...entity } as TranscriptSegmentEntity),
      );

      // 첫 세션: DB에 이전 세그먼트가 endTime=120으로 있음
      transcriptRepository.findOne.mockResolvedValueOnce({
        endTime: 120,
      } as TranscriptSegmentEntity);

      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      // final 이벤트: startTime=5, endTime=10 → 오프셋 120 적용 → 125, 130
      onTranscriptHandler?.({
        type: 'final',
        resultId: 'r1',
        text: '첫 세션 발화',
        startTime: 5,
        endTime: 10,
      });

      const finalPayload = payloads.find(
        (p) => p.type === 'final' && 'startTime' in p,
      ) as RealtimeTranscriptContentPayload | undefined;
      expect(finalPayload?.startTime).toBe(125);
      expect(finalPayload?.endTime).toBe(130);

      // DB 저장도 보정된 값으로 호출됐는지 확인
      expect(transcriptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 125,
          endTime: 130,
        }),
      );

      // 세션 재연결: DB 조회 없이 인메모리 오프셋(130) 사용
      payloads.length = 0;
      transcriptRepository.findOne.mockResolvedValueOnce(null); // DB 조회 안 됨 (인메모리 우선)

      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      // 새 세션 final: startTime=2, endTime=8 → 오프셋 130 적용 → 132, 138
      onTranscriptHandler?.({
        type: 'final',
        resultId: 'r2',
        text: '재연결 후 발화',
        startTime: 2,
        endTime: 8,
      });

      const reconnectPayload = payloads.find(
        (p) => p.type === 'final' && 'startTime' in p,
      ) as RealtimeTranscriptContentPayload | undefined;
      expect(reconnectPayload?.startTime).toBe(132);
      expect(reconnectPayload?.endTime).toBe(138);
    });

    it('preserves in-memory offset across stop/reconnect but clears on explicit clearRealtimeTimeOffset', async () => {
      const payloads: RealtimeTranscriptPayload[] = [];

      let onTranscriptHandler:
        | ((event: {
            type: 'partial' | 'final';
            resultId: string;
            text: string;
            startTime: number;
            endTime: number;
          }) => void)
        | undefined;

      meetingService.findById.mockResolvedValue(
        buildMeeting({
          transcriptionMode: MeetingTranscriptionMode.REALTIME,
        }),
      );

      streamingProvider.startSession.mockImplementation((options) => {
        onTranscriptHandler = options.onTranscript;
        return Promise.resolve();
      });
      streamingProvider.stopSession.mockResolvedValue(undefined);

      transcriptRepository.create.mockImplementation(
        (entity) => entity as TranscriptSegmentEntity,
      );
      transcriptRepository.save.mockImplementation((entity) =>
        Promise.resolve({ id: 'seg-1', ...entity } as TranscriptSegmentEntity),
      );

      // 첫 세션: DB에 이전 세그먼트 없음
      transcriptRepository.findOne.mockResolvedValueOnce(null);

      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      // final 이벤트: endTime=50 → 인메모리 오프셋 50으로 갱신
      onTranscriptHandler?.({
        type: 'final',
        resultId: 'r1',
        text: '발화',
        startTime: 40,
        endTime: 50,
      });

      // stop 세션 — 오프셋은 유지됨 (disconnect 시나리오)
      await service.stopRealtimeSession('meeting-1');

      // reconnect — 인메모리 오프셋 50이 유지되어야 함
      payloads.length = 0;
      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      onTranscriptHandler?.({
        type: 'final',
        resultId: 'r2',
        text: '재연결 발화',
        startTime: 3,
        endTime: 7,
      });

      const afterStopPayload = payloads.find(
        (p) => p.type === 'final' && 'startTime' in p,
      ) as RealtimeTranscriptContentPayload | undefined;
      expect(afterStopPayload?.startTime).toBe(53); // 3 + 50
      expect(afterStopPayload?.endTime).toBe(57); // 7 + 50

      // 명시적 clearRealtimeTimeOffset (회의 종료) 후에는 오프셋 삭제
      service.clearRealtimeTimeOffset('meeting-1');

      payloads.length = 0;
      transcriptRepository.findOne.mockResolvedValueOnce(null); // DB도 비어있다고 가정

      await service.startRealtimeSession(
        'meeting-1',
        (payload) => payloads.push(payload),
        jest.fn(),
        jest.fn(),
      );

      onTranscriptHandler?.({
        type: 'final',
        resultId: 'r3',
        text: '새 회의 발화',
        startTime: 1,
        endTime: 5,
      });

      const afterClearPayload = payloads.find(
        (p) => p.type === 'final' && 'startTime' in p,
      ) as RealtimeTranscriptContentPayload | undefined;
      expect(afterClearPayload?.startTime).toBe(1); // 오프셋 0
      expect(afterClearPayload?.endTime).toBe(5);
    });
  });

  describe('listBatchJobsByMeetingId', () => {
    it('returns jobs sorted by createdAt desc', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      transcriptionJobRepository.find.mockResolvedValue([buildJob()]);

      const jobs = await service.listBatchJobsByMeetingId('meeting-1');

      expect(transcriptionJobRepository.find).toHaveBeenCalledWith({
        where: { meetingId: 'meeting-1' },
        order: { createdAt: 'DESC' },
      });
      expect(jobs).toHaveLength(1);
    });
  });

  describe('issueBatchUpload', () => {
    it('issues an upload session and returns upload metadata', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      s3AudioService.generateUploadUrl.mockResolvedValue({
        uploadUrl: 'https://signed.example/upload',
        s3Key: 'audio/meeting-1/file.webm',
        bucket: 'bucket',
        mediaUri: 's3://bucket/audio/meeting-1/file.webm',
        expiresInSeconds: 600,
      });
      transcriptionUploadRepository.create.mockImplementation(
        (entity) => entity as TranscriptionUploadEntity,
      );
      transcriptionUploadRepository.save.mockImplementation((entity) =>
        Promise.resolve({
          id: 'upload-1',
          ...(entity as object),
        } as TranscriptionUploadEntity),
      );

      const upload = await service.issueBatchUpload('meeting-1');

      expect(upload.uploadId).toBe('upload-1');
      expect(upload.mediaUri).toBe('s3://bucket/audio/meeting-1/file.webm');
      expect(transcriptionUploadRepository.save).toHaveBeenCalled();
    });

    it('rejects issuing a batch upload for completed meetings', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ status: MeetingStatus.COMPLETED }),
      );

      await expect(service.issueBatchUpload('meeting-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('confirmBatchUpload', () => {
    it('verifies uploaded audio and queues a batch job', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      transcriptionUploadRepository.findOne.mockResolvedValue(buildUpload());
      batchTranscriptionProvider.submitBatchJob.mockResolvedValue({
        providerJobId: 'aws-job-queued',
        status: TranscriptionJobStatus.QUEUED,
      });
      transcriptionJobRepository.create.mockImplementation(
        (entity) => entity as TranscriptionJobEntity,
      );
      transcriptionJobRepository.save.mockImplementation((entity) =>
        Promise.resolve({
          ...(entity as object),
          id: (entity as TranscriptionJobEntity).id ?? 'job-1',
        } as TranscriptionJobEntity),
      );
      transcriptionUploadRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as TranscriptionUploadEntity),
      );

      const job = await service.confirmBatchUpload('meeting-1', 'upload-1');

      expect(job.id).toBe('job-1');
      expect(s3AudioService.objectExists).toHaveBeenCalledWith(
        'bucket',
        'audio/meeting-1/file.webm',
      );
      expect(
        transcriptionResultCollectorService.pollAndCollect,
      ).toHaveBeenCalledWith('meeting-1', 'job-1');
    });

    it('returns an existing job idempotently when already queued', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      transcriptionUploadRepository.findOne.mockResolvedValue(
        buildUpload({
          status: TranscriptionUploadStatus.JOB_QUEUED,
          transcriptionJobId: 'job-existing',
        }),
      );
      transcriptionJobRepository.findOne.mockResolvedValue(
        buildJob({ id: 'job-existing' }),
      );

      const job = await service.confirmBatchUpload('meeting-1', 'upload-1');

      expect(job.id).toBe('job-existing');
      expect(batchTranscriptionProvider.submitBatchJob).not.toHaveBeenCalled();
    });

    it('rejects when uploaded audio does not exist yet', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      transcriptionUploadRepository.findOne.mockResolvedValue(buildUpload());
      s3AudioService.objectExists.mockResolvedValue(false);

      await expect(
        service.confirmBatchUpload('meeting-1', 'upload-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(batchTranscriptionProvider.submitBatchJob).not.toHaveBeenCalled();
    });
  });

  describe('queueBatchJob', () => {
    it('queues batch job with trimmed language code', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.BATCH }),
      );
      batchTranscriptionProvider.submitBatchJob.mockResolvedValue({
        providerJobId: 'aws-job-queued',
        status: TranscriptionJobStatus.QUEUED,
      });
      transcriptionJobRepository.create.mockImplementation(
        (entity) => entity as TranscriptionJobEntity,
      );
      transcriptionJobRepository.save.mockImplementation((entity) =>
        Promise.resolve({
          ...(entity as object),
          id: (entity as TranscriptionJobEntity).id ?? 'job-1',
        } as TranscriptionJobEntity),
      );

      const result = await service.queueBatchJob('meeting-1', {
        mediaUri: 's3://bucket/audio.wav',
        languageCode: '  en-US  ',
      });

      expect(
        batchTranscriptionProvider.submitBatchJob.mock.calls[0]?.[0],
      ).toEqual({
        meetingId: 'meeting-1',
        mediaUri: 's3://bucket/audio.wav',
        languageCode: 'en-US',
      });
      expect(result.provider).toBe(TranscriptionJobProvider.AWS_TRANSCRIBE);
      expect(result.status).toBe(TranscriptionJobStatus.QUEUED);
      expect(
        transcriptionResultCollectorService.pollAndCollect,
      ).toHaveBeenCalledWith('meeting-1', 'job-1');
    });

    it('defaults language code to ko-KR when omitted', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      batchTranscriptionProvider.submitBatchJob.mockResolvedValue({
        providerJobId: 'aws-job-queued',
        status: TranscriptionJobStatus.QUEUED,
      });
      transcriptionJobRepository.create.mockImplementation(
        (entity) => entity as TranscriptionJobEntity,
      );
      transcriptionJobRepository.save.mockImplementation((entity) =>
        Promise.resolve({
          ...(entity as object),
          id: (entity as TranscriptionJobEntity).id ?? 'job-1',
        } as TranscriptionJobEntity),
      );

      await service.queueBatchJob('meeting-1', {
        mediaUri: 's3://bucket/audio.wav',
      });

      expect(
        batchTranscriptionProvider.submitBatchJob.mock.calls[0]?.[0],
      ).toEqual({
        meetingId: 'meeting-1',
        mediaUri: 's3://bucket/audio.wav',
        languageCode: 'ko-KR',
      });
    });

    it('rejects queueing when meeting is not in batch mode', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ transcriptionMode: MeetingTranscriptionMode.REALTIME }),
      );

      await expect(
        service.queueBatchJob('meeting-1', {
          mediaUri: 's3://bucket/audio.wav',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(batchTranscriptionProvider.submitBatchJob.mock.calls).toHaveLength(
        0,
      );
    });

    it('stores failed job and throws BadGatewayException when provider fails', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_772_200_000_000);
      meetingService.findById.mockResolvedValue(buildMeeting());
      batchTranscriptionProvider.submitBatchJob.mockRejectedValue(
        new Error('provider unavailable'),
      );
      transcriptionJobRepository.create.mockImplementation(
        (entity) => entity as TranscriptionJobEntity,
      );
      transcriptionJobRepository.save.mockImplementation((entity) =>
        Promise.resolve({
          ...(entity as object),
          id: (entity as TranscriptionJobEntity).id ?? 'job-1',
        } as TranscriptionJobEntity),
      );

      await expect(
        service.queueBatchJob('meeting-1', {
          mediaUri: 's3://bucket/audio.wav',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);

      const savedFailedJob = transcriptionJobRepository.save.mock
        .calls[0]?.[0] as TranscriptionJobEntity | undefined;
      expect(savedFailedJob).toBeDefined();
      if (!savedFailedJob) {
        throw new Error('Expected failed job to be saved');
      }
      expect(savedFailedJob.meetingId).toBe('meeting-1');
      expect(savedFailedJob.provider).toBe(
        TranscriptionJobProvider.AWS_TRANSCRIBE,
      );
      expect(savedFailedJob.status).toBe(TranscriptionJobStatus.FAILED);
      expect(savedFailedJob.errorMessage).toBe('provider unavailable');
      expect(
        savedFailedJob.providerJobId.startsWith('aws-transcribe-meeting1-'),
      ).toBe(true);

      nowSpy.mockRestore();
    });

    it('rejects unmanaged mediaUri values before queueing', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      s3AudioService.isManagedMediaUri.mockReturnValue(false);

      await expect(
        service.queueBatchJob('meeting-1', {
          mediaUri: 's3://other-bucket/file.webm',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(batchTranscriptionProvider.submitBatchJob).not.toHaveBeenCalled();
    });
  });
});
