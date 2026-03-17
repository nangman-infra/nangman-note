import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * 실시간 전사 세션 재연결 시 타임스탬프 보정을 위한 누적 오프셋.
   * Transcribe Streaming은 세션 시작 기준 상대 타임스탬프를 반환하므로,
   * 세션이 재시작되면 이전 세션의 마지막 endTime을 오프셋으로 누적합니다.
   */
  private readonly realtimeTimeOffsets = new Map<string, number>();

  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptionUploadEntity)
    private readonly transcriptionUploadRepository: Repository<TranscriptionUploadEntity>,
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

    // 세션 재시작 시: 인메모리 오프셋이 있으면 우선 사용, 없으면 DB에서 복구
    if (!this.realtimeTimeOffsets.has(meetingId)) {
      const lastSegment = await this.transcriptRepository.findOne({
        where: { meetingId },
        order: { createdAt: 'DESC' },
        select: ['endTime'],
      });
      const dbOffset = lastSegment?.endTime ?? 0;
      this.realtimeTimeOffsets.set(meetingId, dbOffset);
      if (dbOffset > 0) {
        this.logger.debug('transcription.realtime.offset.restored_from_db', {
          meetingId,
          offsetSeconds: dbOffset,
        });
      }
    } else {
      this.logger.debug('transcription.realtime.offset.loaded_from_memory', {
        meetingId,
        offsetSeconds: this.realtimeTimeOffsets.get(meetingId),
      });
    }

    const translateTarget = meeting.translateTargetLanguage || null;

    await this.streamingProvider.startSession({
      meetingId,
      languageCode: meeting.languageCode || null,
      onTranscript: (event: StreamingTranscriptEvent) => {
        this.handleTranscriptEvent(
          meetingId,
          event,
          translateTarget,
          onPayload,
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
  ): Promise<IssuedBatchUpload> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const upload = await this.s3AudioService.generateUploadUrl(meeting.id);
    const issuedUpload = this.transcriptionUploadRepository.create({
      meetingId: meeting.id,
      bucket: upload.bucket,
      s3Key: upload.s3Key,
      mediaUri: upload.mediaUri,
      status: TranscriptionUploadStatus.ISSUED,
      contentType: 'audio/webm',
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
    const upload = await this.loadUploadOrThrow(meeting.id, uploadId);

    const existingJob = await this.findExistingUploadJob(upload);
    if (existingJob) {
      if (
        existingJob.status === TranscriptionJobStatus.QUEUED ||
        existingJob.status === TranscriptionJobStatus.PROCESSING
      ) {
        this.startBatchPolling(meeting.id, existingJob.id);
      }
      return existingJob;
    }

    const objectExists = await this.s3AudioService.objectExists(
      upload.bucket,
      upload.s3Key,
    );
    if (!objectExists) {
      this.logger.warn('transcription.batch.upload.confirm_missing_object', {
        meetingId,
        uploadId,
        ownerSub,
        s3Key: upload.s3Key,
      });
      throw new BadRequestException(
        'Uploaded audio file is not available yet. Retry after the upload finishes.',
      );
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
      );
      upload.status = TranscriptionUploadStatus.JOB_QUEUED;
      upload.transcriptionJobId = job.id;
      upload.jobQueuedAt = new Date();
      upload.errorMessage = null;
      await this.transcriptionUploadRepository.save(upload);
      return job;
    } catch (error) {
      upload.status = TranscriptionUploadStatus.FAILED;
      upload.errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to queue AWS transcription job';
      await this.transcriptionUploadRepository.save(upload);
      throw error;
    }
  }

  async recoverPendingBatchUpload(
    meetingId: string,
    uploadId: string,
    ownerSub?: string,
  ): Promise<{ queued: boolean; objectPresent: boolean; jobId?: string }> {
    const meeting = await this.ensureBatchMeeting(meetingId, ownerSub);
    const upload = await this.loadUploadOrThrow(meeting.id, uploadId);

    const existingJob = await this.findExistingUploadJob(upload);
    if (existingJob) {
      if (
        existingJob.status === TranscriptionJobStatus.QUEUED ||
        existingJob.status === TranscriptionJobStatus.PROCESSING
      ) {
        this.startBatchPolling(meeting.id, existingJob.id);
      }
      return { queued: true, objectPresent: true, jobId: existingJob.id };
    }

    const objectExists = await this.s3AudioService.objectExists(
      upload.bucket,
      upload.s3Key,
    );
    if (!objectExists) {
      upload.status = TranscriptionUploadStatus.FAILED;
      upload.errorMessage =
        upload.errorMessage ?? 'Uploaded audio file not found during recovery';
      await this.transcriptionUploadRepository.save(upload);
      this.logger.warn('transcription.batch.upload.recovery_missing_object', {
        meetingId,
        uploadId,
        ownerSub,
        s3Key: upload.s3Key,
      });
      return { queued: false, objectPresent: false };
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
      );
      upload.status = TranscriptionUploadStatus.JOB_QUEUED;
      upload.transcriptionJobId = job.id;
      upload.jobQueuedAt = new Date();
      upload.errorMessage = null;
      await this.transcriptionUploadRepository.save(upload);
      return { queued: true, objectPresent: true, jobId: job.id };
    } catch (error) {
      upload.status = TranscriptionUploadStatus.FAILED;
      upload.errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to queue AWS transcription job';
      await this.transcriptionUploadRepository.save(upload);
      throw error;
    }
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

    const objectExists =
      await this.s3AudioService.objectExistsForMediaUri(dto.mediaUri);
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
  ): void {
    // 세션 재연결 시 누적된 오프셋을 적용하여 절대 타임스탬프로 변환
    const offset = this.realtimeTimeOffsets.get(meetingId) ?? 0;
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

    // 인메모리 오프셋을 즉시 갱신 — DB 저장 완료를 기다리지 않으므로
    // 빠른 재연결에서도 최신 endTime이 반영됨
    this.realtimeTimeOffsets.set(meetingId, adjustedEndTime);

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
        confidence: 0.9,
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
        errorMessage:
          error instanceof Error ? error.message : String(error),
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
      throw new BadRequestException(
        'Batch transcription is only available for meetings in batch mode',
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
      throw new BadRequestException('Upload session not found for this meeting');
    }

    return upload;
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
