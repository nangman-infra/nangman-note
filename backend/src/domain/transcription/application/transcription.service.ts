import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateBatchTranscriptionJobDto } from './dto/create-batch-transcription-job.dto';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';
import { BATCH_TRANSCRIPTION_PROVIDER } from './ports/batch-transcription-provider.port';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import {
  STREAMING_TRANSCRIPTION_PROVIDER,
  type StreamingTranscriptionProvider,
  type StreamingTranscriptEvent,
} from './ports/streaming-transcription-provider.port';
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from './ports/translation-provider.port';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingProcessingPhase } from '../../meeting/domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobProvider } from '../domain/transcription-job-provider.enum';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

/** 프론트에 emit할 partial/final 이벤트 페이로드 */
export interface RealtimeTranscriptContentPayload {
  type: 'partial' | 'final';
  resultId: string;
  text: string;
  translatedText?: string;
  translationPending?: boolean;
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
  speakerLabel?: string;
}

/** 프론트에 emit할 번역 후행 완료 이벤트 페이로드 */
export interface RealtimeTranslationPayload {
  type: 'translation';
  resultId: string;
  translatedText?: string;
  failed?: boolean;
}

export type RealtimeTranscriptPayload =
  | RealtimeTranscriptContentPayload
  | RealtimeTranslationPayload;

export interface IssuedBatchUpload {
  uploadId: string;
  uploadUrl: string;
  s3Key: string;
  bucket: string;
  mediaUri: string;
  expiresInSeconds: number;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new StructuredLogger(TranscriptionService.name);

  /**
   * 실시간 전사 세션 재연결 시 타임스탬프 보정을 위한 세션 오프셋.
   * Transcribe Streaming은 "세션 시작 기준 누적 상대 타임스탬프"를 반환하므로,
   * 오프셋은 세션이 시작될 때 한 번만 확정하고 세션이 살아있는 동안 고정합니다.
   * (final 이벤트마다 갱신하면 세션 내 두 번째 final부터 오프셋이 복리로 누적되어
   * 타임스탬프가 이중 계산되는 버그가 발생합니다.)
   */
  private readonly realtimeTimeOffsets = new Map<string, number>();

  /**
   * 회의별 마지막으로 저장된 보정 endTime.
   * 다음 세션 시작 시 오프셋 계산에 사용됩니다 (DB 조회보다 우선).
   */
  private readonly realtimeLastEndTimes = new Map<string, number>();

  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptionUploadEntity)
    private readonly transcriptionUploadRepository: Repository<TranscriptionUploadEntity>,
    private readonly dataSource: DataSource,
    private readonly meetingService: MeetingService,
    @Inject(BATCH_TRANSCRIPTION_PROVIDER)
    private readonly batchTranscriptionProvider: BatchTranscriptionProvider,
    @Inject(STREAMING_TRANSCRIPTION_PROVIDER)
    private readonly streamingProvider: StreamingTranscriptionProvider,
    @Inject(TRANSLATION_PROVIDER)
    private readonly translationProvider: TranslationProvider,
    private readonly transcriptionResultCollectorService: TranscriptionResultCollectorService,
    private readonly s3AudioService: S3AudioService,
  ) {}

  async listByMeetingId(
    meetingId: string,
    ownerSub?: string,
  ): Promise<TranscriptSegmentEntity[]> {
    await this.meetingService.findById(meetingId, ownerSub);

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
    ownerSub?: string,
  ): Promise<void> {
    const meeting = await this.meetingService.findById(meetingId, ownerSub);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.REALTIME) {
      throw new BadRequestException(
        'Realtime transcription is disabled for this meeting',
      );
    }

    // 세션 시작 시 오프셋 확정: 인메모리 마지막 endTime이 있으면 우선 사용, 없으면 DB에서 복구.
    // 오프셋은 이 세션이 유지되는 동안 고정됩니다 (final마다 갱신 금지 — 복리 누적 방지).
    const memoryOffset = this.realtimeLastEndTimes.get(meetingId);
    let sessionOffset: number;
    if (memoryOffset !== undefined) {
      sessionOffset = memoryOffset;
      this.logger.debug('transcription.realtime.offset.loaded_from_memory', {
        meetingId,
        offsetSeconds: memoryOffset,
      });
    } else {
      const lastSegment = await this.transcriptRepository.findOne({
        where: { meetingId },
        order: { createdAt: 'DESC' },
        select: ['endTime'],
      });
      sessionOffset = lastSegment?.endTime ?? 0;
      this.realtimeLastEndTimes.set(meetingId, sessionOffset);
      if (sessionOffset > 0) {
        this.logger.debug('transcription.realtime.offset.restored_from_db', {
          meetingId,
          offsetSeconds: sessionOffset,
        });
      }
    }
    this.realtimeTimeOffsets.set(meetingId, sessionOffset);

    const translateTarget = meeting.translateTargetLanguage || null;

    await this.streamingProvider.startSession({
      meetingId,
      languageCode: meeting.languageCode || null,
      onTranscript: (event: StreamingTranscriptEvent) => {
        // 오프셋을 콜백 클로저에 고정한다.
        // 이벤트 시점에 공유 맵을 읽으면 (a) stop 직후 드레인되는 final이
        // clear된 오프셋(0)으로 저장되거나 (b) 세션 교체 직후 구 세션의
        // 잔여 final에 신 세션 오프셋이 적용되는 레이스가 발생한다.
        this.handleTranscriptEvent(
          meetingId,
          event,
          translateTarget,
          onPayload,
          sessionOffset,
        );
      },
      onError,
      onClose,
    });

    this.logger.log('transcription.realtime.session.started', {
      meetingId,
      ownerSub,
      languageCode: meeting.languageCode || null,
      translateTarget,
    });
  }

  /**
   * 오디오 청크를 실시간 전사 세션에 전달
   */
  feedRealtimeAudio(meetingId: string, chunk: Buffer): boolean {
    return this.streamingProvider.feedAudio(meetingId, chunk);
  }

  /**
   * 실시간 전사 세션 종료
   */
  async stopRealtimeSession(meetingId: string): Promise<void> {
    await this.streamingProvider.stopSession(meetingId);
    // 오프셋은 삭제하지 않음 — 세션 재연결 시 인메모리 오프셋을 유지하기 위해.
    // 회의 종료(complete) 시 clearRealtimeTimeOffset()으로 명시적으로 정리합니다.
    this.logger.log('transcription.realtime.session.stopped', {
      meetingId,
    });
  }

  /**
   * 회의 완전 종료 시 인메모리 오프셋 정리.
   * 세션 stop/reconnect 사이클에서는 오프셋을 유지해야 하므로,
   * 이 메서드는 회의가 COMPLETED 상태로 전환될 때만 호출합니다.
   */
  clearRealtimeTimeOffset(meetingId: string): void {
    this.realtimeTimeOffsets.delete(meetingId);
    this.realtimeLastEndTimes.delete(meetingId);
  }

  /**
   * 실시간 세션이 활성 상태인지 확인
   */
  hasActiveRealtimeSession(meetingId: string): boolean {
    return this.streamingProvider.hasActiveSession(meetingId);
  }

  isRealtimeSessionReady(meetingId: string): boolean {
    return this.streamingProvider.isSessionReady(meetingId);
  }

  getActiveRealtimeSessionCount(): number {
    return this.streamingProvider.getActiveSessionCount();
  }

  async switchMeetingToBatchFallback(
    meetingId: string,
    ownerSub?: string,
  ): Promise<boolean> {
    const meeting = await this.meetingService.findById(meetingId, ownerSub);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.REALTIME) {
      return false;
    }

    await this.meetingService.updatePrompt(
      meetingId,
      {
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      },
      ownerSub,
    );
    this.logger.warn('transcription.realtime.capacity_fallback', {
      meetingId,
      ownerSub,
    });
    return true;
  }

  /** 레거시: acceptRealtimeAudioChunk (이전 플레이스홀더 호환) */
  async acceptRealtimeAudioChunk(
    meetingId: string,
    payload: unknown,
    ownerSub?: string,
  ): Promise<boolean> {
    await this.ensureRealtimeEnabled(meetingId, ownerSub);

    // binary payload를 Buffer로 변환하여 streaming provider에 전달
    const chunk = this.toBuffer(payload);
    if (chunk && chunk.length > 0) {
      this.feedRealtimeAudio(meetingId, chunk);
    }
    return true;
  }

  async ensureRealtimeEnabled(
    meetingId: string,
    ownerSub?: string,
  ): Promise<void> {
    const meeting = await this.meetingService.findById(meetingId, ownerSub);

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.REALTIME) {
      throw new BadRequestException(
        'Realtime transcription is disabled for this meeting',
      );
    }
  }

  async listBatchJobsByMeetingId(
    meetingId: string,
    ownerSub?: string,
  ): Promise<TranscriptionJobEntity[]> {
    await this.meetingService.findById(meetingId, ownerSub);

    return this.transcriptionJobRepository.find({
      where: { meetingId },
      order: { createdAt: 'DESC' },
    });
  }

  async issueBatchUpload(
    meetingId: string,
    ownerSub?: string,
    options?: { startOffsetSeconds?: number; contentType?: string },
  ): Promise<IssuedBatchUpload> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const upload = await this.s3AudioService.generateUploadUrl(meeting.id, {
      contentType: options?.contentType,
    });
    const issuedUpload = this.transcriptionUploadRepository.create({
      meetingId: meeting.id,
      bucket: upload.bucket,
      s3Key: upload.s3Key,
      mediaUri: upload.mediaUri,
      status: TranscriptionUploadStatus.ISSUED,
      contentType: upload.contentType,
      startOffsetSeconds: options?.startOffsetSeconds ?? null,
    });
    const savedUpload =
      await this.transcriptionUploadRepository.save(issuedUpload);

    this.logger.log('transcription.batch.upload.issued', {
      meetingId: meeting.id,
      uploadId: savedUpload.id,
      ownerSub,
      s3Key: savedUpload.s3Key,
    });

    return {
      uploadId: savedUpload.id,
      uploadUrl: upload.uploadUrl,
      s3Key: upload.s3Key,
      bucket: upload.bucket,
      mediaUri: upload.mediaUri,
      expiresInSeconds: upload.expiresInSeconds,
    };
  }

  async confirmBatchUpload(
    meetingId: string,
    uploadId: string,
    ownerSub?: string,
  ): Promise<TranscriptionJobEntity> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const result = await this.processBatchUpload(meeting, uploadId, ownerSub, {
      markMissingObjectAsFailed: false,
      throwOnMissingObject: true,
    });
    if (!result.job) {
      throw new BadRequestException(
        'Uploaded audio file is not available yet. Retry after the upload finishes.',
      );
    }
    return result.job;
  }

  async recoverPendingBatchUpload(
    meetingId: string,
    uploadId: string,
    ownerSub?: string,
  ): Promise<{ queued: boolean; objectPresent: boolean; jobId?: string }> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const result = await this.processBatchUpload(meeting, uploadId, ownerSub, {
      markMissingObjectAsFailed: true,
      throwOnMissingObject: false,
    });
    return {
      queued: Boolean(result.job),
      objectPresent: result.objectPresent,
      jobId: result.job?.id,
    };
  }

  async reconcilePendingBatchUpload(
    meetingId: string,
    uploadId: string,
    ownerSub?: string,
  ): Promise<{ queued: boolean; objectPresent: boolean; jobId?: string }> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const result = await this.processBatchUpload(meeting, uploadId, ownerSub, {
      markMissingObjectAsFailed: false,
      throwOnMissingObject: false,
    });
    return {
      queued: Boolean(result.job),
      objectPresent: result.objectPresent,
      jobId: result.job?.id,
    };
  }

  async queueBatchJob(
    meetingId: string,
    dto: CreateBatchTranscriptionJobDto,
    ownerSub?: string,
  ): Promise<TranscriptionJobEntity> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);

    if (!this.s3AudioService.isManagedMediaUri(dto.mediaUri)) {
      throw new BadRequestException(
        'mediaUri must reference a managed audio upload for this service',
      );
    }

    const objectExists = await this.s3AudioService.objectExistsForMediaUri(
      dto.mediaUri,
    );
    if (!objectExists) {
      throw new BadRequestException(
        'Uploaded audio file is not available yet. Retry after the upload finishes.',
      );
    }

    const job = await this.queueBatchJobForMeeting(
      meeting,
      dto.mediaUri,
      dto.languageCode,
      ownerSub,
    );

    const existingUpload = await this.transcriptionUploadRepository.findOne({
      where: { meetingId: meeting.id, mediaUri: dto.mediaUri },
      order: { createdAt: 'DESC' },
    });
    if (existingUpload) {
      existingUpload.status = TranscriptionUploadStatus.JOB_QUEUED;
      existingUpload.transcriptionJobId = job.id;
      existingUpload.confirmedAt = existingUpload.confirmedAt ?? new Date();
      existingUpload.jobQueuedAt = new Date();
      existingUpload.errorMessage = null;
      await this.transcriptionUploadRepository.save(existingUpload);
    }

    return job;
  }

  /**
   * Transcribe 결과 이벤트 처리:
   * - partial: 바로 프론트에 전달 (번역 X, DB 저장 X)
   * - final: 원문 즉시 전달 + DB 저장 + 번역 fire-and-forget 후행
   *
   * 전사 원문은 즉시 emit하고, 번역은 비동기로 후행하므로 전사 실시간성을 저하시키지 않음.
   */
  private handleTranscriptEvent(
    meetingId: string,
    event: StreamingTranscriptEvent,
    translateTarget: string | null,
    onPayload: (payload: RealtimeTranscriptPayload) => void,
    sessionOffset: number,
  ): void {
    // 세션 시작 시 클로저에 고정된 오프셋을 적용하여 절대 타임스탬프로 변환
    const offset = sessionOffset;
    const adjustedStartTime = event.startTime + offset;
    const adjustedEndTime = event.endTime + offset;

    if (event.type === 'partial') {
      this.emitPayload(onPayload, {
        type: 'partial',
        resultId: event.resultId,
        text: event.text,
        startTime: adjustedStartTime,
        endTime: adjustedEndTime,
        detectedLanguage: event.detectedLanguage,
        speakerLabel: event.speakerLabel,
      });
      return;
    }

    const needsTranslation = this.shouldTranslate(
      translateTarget,
      event.detectedLanguage,
    );

    // final 원문은 즉시 전달 (번역 완료를 기다리지 않음)
    this.emitPayload(onPayload, {
      type: 'final',
      resultId: event.resultId,
      text: event.text,
      translationPending: needsTranslation,
      startTime: adjustedStartTime,
      endTime: adjustedEndTime,
      detectedLanguage: event.detectedLanguage,
      speakerLabel: event.speakerLabel,
    });

    // DB 저장 (보정된 타임스탬프 사용)
    const adjustedEvent: StreamingTranscriptEvent = {
      ...event,
      startTime: adjustedStartTime,
      endTime: adjustedEndTime,
    };
    const savedSegmentIdPromise = this.saveFinalSegment(
      meetingId,
      adjustedEvent,
    );

    // 마지막 보정 endTime만 기록 — 세션 오프셋 자체는 갱신하지 않음.
    // (Transcribe 타임스탬프는 세션 기준 누적값이므로, 세션 내에서 오프셋을 갱신하면
    // 이후 final마다 시간이 이중으로 더해지는 복리 누적이 발생)
    // Math.max: 세션 교체 직후 늦게 도착한 구 세션 final이 값을 되돌리지 않도록.
    // 회의 종료(clearRealtimeTimeOffset) 후 도착한 드레인 final은 기록하지 않는다 (맵 부활 방지).
    if (this.realtimeTimeOffsets.has(meetingId)) {
      const previousEnd = this.realtimeLastEndTimes.get(meetingId) ?? 0;
      this.realtimeLastEndTimes.set(
        meetingId,
        Math.max(previousEnd, adjustedEndTime),
      );
    }

    // 번역이 필요한 경우 fire-and-forget으로 후행 처리
    if (needsTranslation && translateTarget) {
      void this.translateAndPatchSegment(
        meetingId,
        event,
        translateTarget,
        onPayload,
        savedSegmentIdPromise,
      );
    }
  }

  private shouldTranslate(
    translateTarget: string | null,
    detectedLanguage: string | undefined,
  ): boolean {
    if (!translateTarget) return false;
    return !this.translationProvider.isSameLanguage(
      detectedLanguage,
      translateTarget,
    );
  }

  private async saveFinalSegment(
    meetingId: string,
    event: StreamingTranscriptEvent,
  ): Promise<string | null> {
    try {
      const segment = this.transcriptRepository.create({
        meetingId,
        startTime: event.startTime,
        endTime: event.endTime,
        text: event.text,
        confidence: event.confidence ?? 0.9,
        detectedLanguage: event.detectedLanguage,
        speakerLabel: event.speakerLabel,
      });
      const saved = await this.transcriptRepository.save(segment);
      return saved.id;
    } catch (error) {
      this.logger.warn('transcription.segment.save_failed', {
        meetingId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async translateAndPatchSegment(
    meetingId: string,
    event: StreamingTranscriptEvent,
    translateTarget: string,
    onPayload: (payload: RealtimeTranscriptPayload) => void,
    savedSegmentIdPromise: Promise<string | null>,
  ): Promise<void> {
    try {
      const result = await this.translationProvider.translateText(
        event.text,
        translateTarget,
        event.detectedLanguage ? event.detectedLanguage.split('-')[0] : 'auto',
      );
      const translatedText = result.translatedText?.trim();

      if (!translatedText) {
        this.emitPayload(onPayload, {
          type: 'translation',
          resultId: event.resultId,
          failed: true,
        });
        return;
      }

      this.emitPayload(onPayload, {
        type: 'translation',
        resultId: event.resultId,
        translatedText,
      });

      const savedSegmentId = await savedSegmentIdPromise;
      if (savedSegmentId) {
        // save 경로를 사용해 암호화 subscriber(beforeUpdate/afterUpdate)를 일관되게 거치도록 보장
        const patch = this.transcriptRepository.create({
          id: savedSegmentId,
          translatedText,
        });
        await this.transcriptRepository.save(patch);
      }
    } catch (error) {
      this.logger.warn('transcription.translation.failed', {
        meetingId,
        targetLanguage: translateTarget,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      this.emitPayload(onPayload, {
        type: 'translation',
        resultId: event.resultId,
        failed: true,
      });
    }
  }

  private emitPayload(
    onPayload: (payload: RealtimeTranscriptPayload) => void,
    payload: RealtimeTranscriptPayload,
  ): void {
    try {
      onPayload(payload);
    } catch (error) {
      this.logger.warn('transcription.payload.emit_failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
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

  private async ensureBatchMeeting(
    meetingId: string,
    ownerSub?: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.meetingService.findById(meetingId, ownerSub);

    if (meeting.status === MeetingStatus.COMPLETED) {
      throw new BadRequestException(
        'Batch transcription can no longer be queued for completed meetings',
      );
    }

    if (meeting.transcriptionMode !== MeetingTranscriptionMode.BATCH) {
      // 실시간 세션이 아직 활성이면 전환하지 않는다.
      // (전환 시 실시간 세션 재시작이 400으로 실패해 서킷브레이커까지 연쇄될 수 있음)
      if (this.streamingProvider.hasActiveSession(meetingId)) {
        throw new BadRequestException(
          'Realtime transcription session is still active for this meeting',
        );
      }

      // 실시간→배치 폴백 시 프론트의 모드 변경 API 호출이 실패했을 수 있다.
      // 배치 업로드 요청 자체가 배치 처리 의사표시이므로 모드를 자동 전환해
      // 폴백 이후 녹음분의 업로드가 400으로 거부되는 것을 방지한다.
      this.logger.warn('transcription.batch.mode_auto_switched', {
        meetingId,
        ownerSub,
        previousMode: meeting.transcriptionMode,
      });
      return this.meetingService.updatePrompt(
        meetingId,
        { transcriptionMode: MeetingTranscriptionMode.BATCH },
        ownerSub,
      );
    }

    return meeting;
  }

  private async loadUploadOrThrow(
    meetingId: string,
    uploadId: string,
  ): Promise<TranscriptionUploadEntity> {
    const upload = await this.transcriptionUploadRepository.findOne({
      where: { id: uploadId, meetingId },
    });

    if (!upload) {
      throw new BadRequestException(
        'Upload session not found for this meeting',
      );
    }

    return upload;
  }

  private async processBatchUpload(
    meeting: MeetingEntity,
    uploadId: string,
    ownerSub: string | undefined,
    options: {
      markMissingObjectAsFailed: boolean;
      throwOnMissingObject: boolean;
    },
  ): Promise<{
    job: TranscriptionJobEntity | null;
    objectPresent: boolean;
  }> {
    return this.withUploadLock(uploadId, async () => {
      const upload = await this.loadUploadOrThrow(meeting.id, uploadId);

      const existingJob = await this.findExistingUploadJob(upload);
      if (existingJob) {
        if (
          existingJob.status === TranscriptionJobStatus.QUEUED ||
          existingJob.status === TranscriptionJobStatus.PROCESSING
        ) {
          this.startBatchPolling(meeting.id, existingJob.id);
        }
        return { job: existingJob, objectPresent: true };
      }

      const objectExists = await this.s3AudioService.objectExists(
        upload.bucket,
        upload.s3Key,
      );
      if (!objectExists) {
        if (options.markMissingObjectAsFailed) {
          upload.status = TranscriptionUploadStatus.FAILED;
          upload.errorMessage =
            upload.errorMessage ??
            'Uploaded audio file not found during recovery';
          await this.transcriptionUploadRepository.save(upload);
          this.logger.warn(
            'transcription.batch.upload.recovery_missing_object',
            {
              meetingId: meeting.id,
              uploadId,
              ownerSub,
              s3Key: upload.s3Key,
            },
          );
        } else {
          this.logger.debug('transcription.batch.upload.not_ready', {
            meetingId: meeting.id,
            uploadId,
            ownerSub,
            s3Key: upload.s3Key,
          });
        }

        if (options.throwOnMissingObject) {
          throw new BadRequestException(
            'Uploaded audio file is not available yet. Retry after the upload finishes.',
          );
        }

        return { job: null, objectPresent: false };
      }

      upload.status = TranscriptionUploadStatus.UPLOADED;
      upload.confirmedAt = upload.confirmedAt ?? new Date();
      upload.errorMessage = null;
      await this.transcriptionUploadRepository.save(upload);

      try {
        const job = await this.queueBatchJobForMeeting(
          meeting,
          upload.mediaUri,
          meeting.languageCode,
          ownerSub,
          upload.startOffsetSeconds ?? null,
        );
        upload.status = TranscriptionUploadStatus.JOB_QUEUED;
        upload.transcriptionJobId = job.id;
        upload.jobQueuedAt = new Date();
        upload.errorMessage = null;
        await this.transcriptionUploadRepository.save(upload);
        return { job, objectPresent: true };
      } catch (error) {
        upload.status = TranscriptionUploadStatus.FAILED;
        upload.errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to queue AWS transcription job';
        await this.transcriptionUploadRepository.save(upload);
        throw error;
      }
    });
  }

  private async withUploadLock<T>(
    uploadId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const dbType = this.dataSource.options.type;
    if (dbType !== 'postgres') {
      return task();
    }

    await this.dataSource.query('SELECT pg_advisory_lock(hashtext($1))', [
      `transcription-upload:${uploadId}`,
    ]);

    try {
      return await task();
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock(hashtext($1))', [
        `transcription-upload:${uploadId}`,
      ]);
    }
  }

  private async findExistingUploadJob(
    upload: TranscriptionUploadEntity,
  ): Promise<TranscriptionJobEntity | null> {
    if (!upload.transcriptionJobId) {
      return null;
    }

    return (
      (await this.transcriptionJobRepository.findOne({
        where: { id: upload.transcriptionJobId },
      })) ?? null
    );
  }

  private async queueBatchJobForMeeting(
    meeting: MeetingEntity,
    mediaUri: string,
    requestedLanguageCode?: string | null,
    ownerSub?: string,
    startOffsetSeconds?: number | null,
  ): Promise<TranscriptionJobEntity> {
    const languageCode = requestedLanguageCode?.trim() || 'ko-KR';

    try {
      const submission = await this.batchTranscriptionProvider.submitBatchJob({
        meetingId: meeting.id,
        mediaUri,
        languageCode,
      });

      const queuedJob = this.transcriptionJobRepository.create({
        meetingId: meeting.id,
        provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
        providerJobId: submission.providerJobId,
        status: submission.status,
        mediaUri,
        languageCode,
        startOffsetSeconds: startOffsetSeconds ?? null,
      });
      const savedJob = await this.transcriptionJobRepository.save(queuedJob);
      await this.meetingService.updateProcessingPhase(
        meeting.id,
        MeetingProcessingPhase.TRANSCRIBING,
        ownerSub,
        { status: meeting.status, needsAttention: false },
      );
      this.startBatchPolling(meeting.id, savedJob.id);
      return savedJob;
    } catch (error) {
      const failedJob = this.transcriptionJobRepository.create({
        meetingId: meeting.id,
        provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
        providerJobId: this.buildFallbackProviderJobId(meeting.id),
        status: TranscriptionJobStatus.FAILED,
        mediaUri,
        languageCode,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to queue AWS transcription job',
      });
      await this.transcriptionJobRepository.save(failedJob);
      await this.meetingService.markNeedsAttention(meeting.id, ownerSub);

      throw new BadGatewayException(
        error instanceof Error
          ? error.message
          : 'Failed to queue AWS transcription job',
      );
    }
  }

  private startBatchPolling(meetingId: string, jobId: string): void {
    this.transcriptionResultCollectorService
      .pollAndCollect(meetingId, jobId)
      .then((result) => {
        this.logger.log('transcription.batch.poll.completed', {
          meetingId,
          jobId,
          success: result.success,
          segmentCount: result.segmentCount,
        });
      })
      .catch((error: Error) => {
        this.logger.error('transcription.batch.poll.failed', error, {
          meetingId,
          jobId,
        });
      });
  }
}
