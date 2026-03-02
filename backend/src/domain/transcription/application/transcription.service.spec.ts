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
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import type { StreamingTranscriptionProvider } from './ports/streaming-transcription-provider.port';
import type { TranslationProvider } from './ports/translation-provider.port';
import {
  type RealtimeTranscriptPayload,
  TranscriptionService,
} from './transcription.service';

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let transcriptRepository: jest.Mocked<
    Pick<
      Repository<TranscriptSegmentEntity>,
      'find' | 'create' | 'save' | 'update'
    >
  >;
  let transcriptionJobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'find' | 'create' | 'save'>
  >;
  let meetingService: jest.Mocked<
    Pick<MeetingService, 'findById' | 'updatePrompt'>
  >;
  let batchTranscriptionProvider: jest.Mocked<BatchTranscriptionProvider>;
  let streamingProvider: jest.Mocked<StreamingTranscriptionProvider>;
  let translationProvider: jest.Mocked<
    Pick<TranslationProvider, 'translateText' | 'isSameLanguage'>
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

  beforeEach(() => {
    transcriptRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    transcriptionJobRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    meetingService = {
      findById: jest.fn(),
      updatePrompt: jest.fn(),
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

    service = new TranscriptionService(
      transcriptRepository as unknown as Repository<TranscriptSegmentEntity>,
      transcriptionJobRepository as unknown as Repository<TranscriptionJobEntity>,
      meetingService as unknown as MeetingService,
      batchTranscriptionProvider,
      streamingProvider,
      translationProvider,
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

      expect(meetingService.findById).toHaveBeenCalledWith('meeting-1');
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
      expect(meetingService.updatePrompt).toHaveBeenCalledWith('meeting-1', {
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      });
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
      transcriptRepository.save.mockResolvedValue({
        id: 'segment-1',
      } as TranscriptSegmentEntity);
      transcriptRepository.update.mockResolvedValue({
        generatedMaps: [],
        raw: [],
        affected: 1,
      });

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

      expect(transcriptRepository.update).toHaveBeenCalledWith(
        { id: 'segment-1' },
        { translatedText: 'hello team' },
      );
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
        Promise.resolve(entity as TranscriptionJobEntity),
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
        Promise.resolve(entity as TranscriptionJobEntity),
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
        Promise.resolve(entity as TranscriptionJobEntity),
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
  });
});
