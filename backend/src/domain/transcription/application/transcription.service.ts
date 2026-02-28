import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBatchTranscriptionJobDto } from './dto/create-batch-transcription-job.dto';
import { BATCH_TRANSCRIPTION_PROVIDER } from './ports/batch-transcription-provider.port';
import type { BatchTranscriptionProvider } from './ports/batch-transcription-provider.port';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobProvider } from '../domain/transcription-job-provider.enum';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';

@Injectable()
export class TranscriptionService {
  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    private readonly meetingService: MeetingService,
    @Inject(BATCH_TRANSCRIPTION_PROVIDER)
    private readonly batchTranscriptionProvider: BatchTranscriptionProvider,
  ) {}

  async listByMeetingId(meetingId: string): Promise<TranscriptSegmentEntity[]> {
    await this.meetingService.findById(meetingId);

    return this.transcriptRepository.find({
      where: { meetingId },
      order: { startTime: 'ASC' },
    });
  }

  async acceptRealtimeAudioChunk(
    meetingId: string,
    payload: unknown,
  ): Promise<boolean> {
    await this.ensureRealtimeEnabled(meetingId);
    this.estimatePayloadSize(payload);
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

  private estimatePayloadSize(payload: unknown): number {
    if (typeof payload === 'string') {
      return Buffer.byteLength(payload);
    }

    if (payload instanceof Uint8Array) {
      return payload.byteLength;
    }

    if (payload instanceof ArrayBuffer) {
      return payload.byteLength;
    }

    return Buffer.byteLength(JSON.stringify(payload ?? {}));
  }

  private buildFallbackProviderJobId(meetingId: string): string {
    return `aws-transcribe-${meetingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${Date.now().toString(36)}`;
  }
}
