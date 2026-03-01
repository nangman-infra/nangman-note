import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBatchTranscriptionJobDto } from './dto/create-batch-transcription-job.dto';
import { BATCH_TRANSCRIPTION_PROVIDER } from './ports/batch-transcription-provider.port';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import {
  STREAMING_TRANSCRIPTION_PROVIDER,
  type StreamingTranscriptionProvider,
  type StreamingTranscriptEvent,
} from './ports/streaming-transcription-provider.port';
import { TranslateService } from '../../../shared/aws/translate/translate.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobProvider } from '../domain/transcription-job-provider.enum';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';

/** 프론트에 emit할 partial/final 이벤트 페이로드 */
export interface RealtimeTranscriptPayload {
  type: 'partial' | 'final';
  resultId: string;
  text: string;
  translatedText?: string;
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    private readonly meetingService: MeetingService,
    @Inject(BATCH_TRANSCRIPTION_PROVIDER)
    private readonly batchTranscriptionProvider: BatchTranscriptionProvider,
    @Inject(STREAMING_TRANSCRIPTION_PROVIDER)
    private readonly streamingProvider: StreamingTranscriptionProvider,
    private readonly translateService: TranslateService,
  ) {}

  async listByMeetingId(meetingId: string): Promise<TranscriptSegmentEntity[]> {
    await this.meetingService.findById(meetingId);

    return this.transcriptRepository.find({
      where: { meetingId },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * 실시간 전사 세션 시작
   * @returns onTranscript 콜백이 호출될 때마다 RealtimeTranscriptPayload를 반환하는 콜백 등록
   */
  async startRealtimeSession(
    meetingId: string,
    onPayload: (payload: RealtimeTranscriptPayload) => void,
    onError: (error: Error) => void,
    onClose: () => void,
  ): Promise<void> {
    const meeting = await this.meetingService.findById(meetingId);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.REALTIME) {
      throw new BadRequestException(
        'Realtime transcription is disabled for this meeting',
      );
    }

    const translateTarget = meeting.translateTargetLanguage || null;

    await this.streamingProvider.startSession({
      meetingId,
      languageCode: meeting.languageCode || null,
      onTranscript: (event: StreamingTranscriptEvent) => {
        void this.handleTranscriptEvent(
          meetingId,
          event,
          translateTarget,
          onPayload,
        );
      },
      onError,
      onClose,
    });

    this.logger.log(`Realtime session started for meeting ${meetingId}`);
  }

  /**
   * 오디오 청크를 실시간 전사 세션에 전달
   */
  feedRealtimeAudio(meetingId: string, chunk: Buffer): void {
    this.streamingProvider.feedAudio(meetingId, chunk);
  }

  /**
   * 실시간 전사 세션 종료
   */
  async stopRealtimeSession(meetingId: string): Promise<void> {
    await this.streamingProvider.stopSession(meetingId);
    this.logger.log(`Realtime session stopped for meeting ${meetingId}`);
  }

  /**
   * 실시간 세션이 활성 상태인지 확인
   */
  hasActiveRealtimeSession(meetingId: string): boolean {
    return this.streamingProvider.hasActiveSession(meetingId);
  }

  /** 레거시: acceptRealtimeAudioChunk (이전 플레이스홀더 호환) */
  async acceptRealtimeAudioChunk(
    meetingId: string,
    payload: unknown,
  ): Promise<boolean> {
    await this.ensureRealtimeEnabled(meetingId);

    // binary payload를 Buffer로 변환하여 streaming provider에 전달
    const chunk = this.toBuffer(payload);
    if (chunk && chunk.length > 0) {
      this.feedRealtimeAudio(meetingId, chunk);
    }
    return true;
  }

  async ensureRealtimeEnabled(meetingId: string): Promise<void> {
    const meeting = await this.meetingService.findById(meetingId);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.REALTIME) {
      throw new BadRequestException(
        'Realtime transcription is disabled for this meeting',
      );
    }
  }

  async listBatchJobsByMeetingId(
    meetingId: string,
  ): Promise<TranscriptionJobEntity[]> {
    await this.meetingService.findById(meetingId);

    return this.transcriptionJobRepository.find({
      where: { meetingId },
      order: { createdAt: 'DESC' },
    });
  }

  async queueBatchJob(
    meetingId: string,
    dto: CreateBatchTranscriptionJobDto,
  ): Promise<TranscriptionJobEntity> {
    const meeting = await this.meetingService.findById(meetingId);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.BATCH) {
      throw new BadRequestException(
        'Batch transcription is only available for meetings in batch mode',
      );
    }

    const languageCode = dto.languageCode?.trim() || 'ko-KR';
    try {
      const submission = await this.batchTranscriptionProvider.submitBatchJob({
        meetingId,
        mediaUri: dto.mediaUri,
        languageCode,
      });

      const queuedJob = this.transcriptionJobRepository.create({
        meetingId,
        provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
        providerJobId: submission.providerJobId,
        status: submission.status,
        mediaUri: dto.mediaUri,
        languageCode,
      });

      return this.transcriptionJobRepository.save(queuedJob);
    } catch (error) {
      const failedJob = this.transcriptionJobRepository.create({
        meetingId,
        provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
        providerJobId: this.buildFallbackProviderJobId(meetingId),
        status: TranscriptionJobStatus.FAILED,
        mediaUri: dto.mediaUri,
        languageCode,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to queue AWS transcription job',
      });
      await this.transcriptionJobRepository.save(failedJob);

      throw new BadGatewayException(
        error instanceof Error
          ? error.message
          : 'Failed to queue AWS transcription job',
      );
    }
  }

  /**
   * Transcribe 결과 이벤트 처리:
   * - partial: 바로 프론트에 전달 (번역 X, DB 저장 X)
   * - final: 번역(필요시) + DB 저장 + 프론트에 전달
   */
  private async handleTranscriptEvent(
    meetingId: string,
    event: StreamingTranscriptEvent,
    translateTarget: string | null,
    onPayload: (payload: RealtimeTranscriptPayload) => void,
  ): Promise<void> {
    if (event.type === 'partial') {
      // partial은 번역/저장 없이 바로 전달
      onPayload({
        type: 'partial',
        resultId: event.resultId,
        text: event.text,
        startTime: event.startTime,
        endTime: event.endTime,
        detectedLanguage: event.detectedLanguage,
      });
      return;
    }

    // final 결과: 번역 + DB 저장
    let translatedText: string | undefined;

    if (
      translateTarget &&
      !this.translateService.isSameLanguage(
        event.detectedLanguage,
        translateTarget,
      )
    ) {
      try {
        const result = await this.translateService.translateText(
          event.text,
          translateTarget,
          event.detectedLanguage
            ? event.detectedLanguage.split('-')[0]
            : 'auto',
        );
        translatedText = result.translatedText;
      } catch (error) {
        this.logger.warn(
          `Translation failed for meeting ${meetingId}: ${error}`,
        );
      }
    }

    // DB 저장 (암호화는 EncryptionSubscriber가 자동 처리)
    try {
      const segment = this.transcriptRepository.create({
        meetingId,
        startTime: event.startTime,
        endTime: event.endTime,
        text: event.text,
        confidence: 0.95, // Transcribe Streaming은 개별 confidence를 주지 않음
        translatedText,
        detectedLanguage: event.detectedLanguage,
      });
      await this.transcriptRepository.save(segment);
    } catch (error) {
      this.logger.warn(
        `Failed to save transcript segment for meeting ${meetingId}: ${error}`,
      );
    }

    // 프론트에 전달
    onPayload({
      type: 'final',
      resultId: event.resultId,
      text: event.text,
      translatedText,
      startTime: event.startTime,
      endTime: event.endTime,
      detectedLanguage: event.detectedLanguage,
    });
  }

  private toBuffer(payload: unknown): Buffer | null {
    if (Buffer.isBuffer(payload)) return payload;
    if (payload instanceof Uint8Array) return Buffer.from(payload);
    if (payload instanceof ArrayBuffer) return Buffer.from(payload);
    if (typeof payload === 'string') {
      // base64 encoded
      try {
        return Buffer.from(payload, 'base64');
      } catch {
        return null;
      }
    }
    return null;
  }

  private buildFallbackProviderJobId(meetingId: string): string {
    return `aws-transcribe-${meetingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${Date.now().toString(36)}`;
  }
}
