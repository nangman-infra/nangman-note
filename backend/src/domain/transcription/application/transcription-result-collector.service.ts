import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BATCH_TRANSCRIPTION_PROVIDER,
  type BatchTranscriptionProvider,
} from './ports/batch-transcription-provider.port';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { ResultService } from '../../result/application/result.service';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';

const POLL_INTERVAL_MS = 5_000; // 5초
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10분

interface TranscribeResultItem {
  start_time?: string;
  end_time?: string;
  alternatives?: Array<{
    confidence?: string;
    content?: string;
  }>;
  type?: string;
}

interface TranscribeResultJson {
  results?: {
    items?: TranscribeResultItem[];
    transcripts?: Array<{ transcript?: string }>;
  };
}

@Injectable()
export class TranscriptionResultCollectorService {
  private readonly logger = new Logger(
    TranscriptionResultCollectorService.name,
  );

  constructor(
    @InjectRepository(TranscriptionJobEntity)
    private readonly jobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly segmentRepository: Repository<TranscriptSegmentEntity>,
    @Inject(BATCH_TRANSCRIPTION_PROVIDER)
    private readonly batchProvider: BatchTranscriptionProvider,
    private readonly meetingService: MeetingService,
    private readonly resultService: ResultService,
    private readonly s3AudioService: S3AudioService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 배치 전사 잡 완료를 폴링하고, 결과를 파싱하여 DB에 저장합니다.
   * 완료 후 오디오 파일을 삭제하고 Meeting 상태를 COMPLETED로 변경합니다.
   */
  async pollAndCollect(
    meetingId: string,
    jobId: string,
  ): Promise<{ success: boolean; segmentCount: number }> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`Transcription job ${jobId} not found`);
      return { success: false, segmentCount: 0 };
    }

    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
      try {
        const result = await this.batchProvider.getJobStatus(job.providerJobId);

        // 상태 업데이트
        job.status = result.status;
        if (result.transcriptUri) {
          job.transcriptUri = result.transcriptUri;
        }
        if (result.errorMessage) {
          job.errorMessage = result.errorMessage;
        }
        await this.jobRepository.save(job);

        if (result.status === TranscriptionJobStatus.COMPLETED) {
          this.logger.log(
            `Transcription job ${job.providerJobId} completed for meeting ${meetingId}`,
          );

          // 결과 파싱 + DB 저장
          const segmentCount = await this.parseAndSaveResults(
            meetingId,
            result.transcriptUri,
          );

          // 오디오 파일 삭제
          await this.deleteAudioFile(job.mediaUri);

          // 결과 생성 단계 진입 이벤트
          this.emitGeneratingPhase(meetingId);

          // AI 결과물 자동 생성
          await this.triggerResultGeneration(meetingId);

          // 생성 완료 후 Meeting 상태 변경
          await this.updateMeetingStatus(meetingId);

          return { success: true, segmentCount };
        }

        if (result.status === TranscriptionJobStatus.FAILED) {
          this.logger.error(
            `Transcription job ${job.providerJobId} failed: ${result.errorMessage}`,
          );
          await this.finalizeAfterFailedTranscription(meetingId, job.mediaUri);
          return { success: false, segmentCount: 0 };
        }

        // IN_PROGRESS 또는 QUEUED → 대기 후 재시도
        await this.sleep(POLL_INTERVAL_MS);
      } catch (error) {
        this.logger.error(
          `Error polling job ${job.providerJobId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        await this.sleep(POLL_INTERVAL_MS);
      }
    }

    // 타임아웃
    job.status = TranscriptionJobStatus.FAILED;
    job.errorMessage = `Polling timed out after ${MAX_POLL_DURATION_MS / 1000}s`;
    await this.jobRepository.save(job);

    this.logger.error(
      `Transcription job ${job.providerJobId} timed out for meeting ${meetingId}`,
    );
    await this.finalizeAfterFailedTranscription(meetingId, job.mediaUri);
    return { success: false, segmentCount: 0 };
  }

  private async parseAndSaveResults(
    meetingId: string,
    transcriptUri?: string,
  ): Promise<number> {
    if (!transcriptUri) {
      this.logger.warn('No transcript URI provided, skipping parse');
      return 0;
    }

    try {
      // transcriptUri는 S3 URI (s3://bucket/key) 또는 HTTPS URL
      const jsonContent = await this.fetchTranscriptJson(transcriptUri);
      const parsedUnknown: unknown = JSON.parse(jsonContent);
      if (!this.isTranscribeResultJson(parsedUnknown)) {
        this.logger.warn(
          `Unexpected transcript json shape for meeting ${meetingId}`,
        );
        return 0;
      }

      const items = parsedUnknown.results?.items ?? [];
      const segments = this.itemsToSegments(meetingId, items);

      if (segments.length > 0) {
        await this.segmentRepository.save(segments);
        this.logger.log(
          `Saved ${segments.length} transcript segments for meeting ${meetingId}`,
        );
      }

      return segments.length;
    } catch (error) {
      this.logger.error(
        `Failed to parse transcript for meeting ${meetingId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  private itemsToSegments(
    meetingId: string,
    items: TranscribeResultItem[],
  ): TranscriptSegmentEntity[] {
    const segments: TranscriptSegmentEntity[] = [];
    let currentText = '';
    let currentStartTime = 0;
    let currentEndTime = 0;
    let currentConfidence = 0;
    let wordCount = 0;

    for (const item of items) {
      if (item.type === 'punctuation') {
        // 구두점은 현재 텍스트에 이어붙이기
        const content = item.alternatives?.[0]?.content ?? '';
        currentText += content;
        continue;
      }

      // pronunciation (단어)
      const content = item.alternatives?.[0]?.content ?? '';
      const confidence = parseFloat(
        item.alternatives?.[0]?.confidence ?? '0.9',
      );
      const startTime = parseFloat(item.start_time ?? '0');
      const endTime = parseFloat(item.end_time ?? '0');

      if (wordCount === 0) {
        currentStartTime = startTime;
      }

      currentText += (currentText.length > 0 ? ' ' : '') + content;
      currentEndTime = endTime;
      currentConfidence += confidence;
      wordCount++;

      // 약 15단어 또는 10초마다 세그먼트 구분
      if (wordCount >= 15 || endTime - currentStartTime >= 10) {
        const segment = this.segmentRepository.create({
          meetingId,
          startTime: currentStartTime,
          endTime: currentEndTime,
          text: currentText.trim(),
          confidence: wordCount > 0 ? currentConfidence / wordCount : 0.9,
        });
        segments.push(segment);

        currentText = '';
        currentConfidence = 0;
        wordCount = 0;
      }
    }

    // 남은 텍스트
    if (currentText.trim().length > 0 && wordCount > 0) {
      const segment = this.segmentRepository.create({
        meetingId,
        startTime: currentStartTime,
        endTime: currentEndTime,
        text: currentText.trim(),
        confidence: currentConfidence / wordCount,
      });
      segments.push(segment);
    }

    return segments;
  }

  private async fetchTranscriptJson(transcriptUri: string): Promise<string> {
    // S3 URI 형식: s3://bucket/key
    if (transcriptUri.startsWith('s3://')) {
      const parsed = this.parseS3Uri(transcriptUri);
      if (!parsed) {
        throw new Error(`Invalid S3 URI: ${transcriptUri}`);
      }

      return this.s3AudioService.getObjectAsStringFromBucket(
        parsed.bucket,
        parsed.key,
      );
    }

    // HTTPS S3 URL 형식: https://s3.{region}.amazonaws.com/{bucket}/{key}
    // 또는: https://{bucket}.s3.{region}.amazonaws.com/{key}
    const s3HttpsParsed = this.parseS3HttpsUrl(transcriptUri);
    if (s3HttpsParsed) {
      this.logger.log(
        `Fetching transcript via SDK: bucket=${s3HttpsParsed.bucket}, key=${s3HttpsParsed.key}`,
      );
      return this.s3AudioService.getObjectAsStringFromBucket(
        s3HttpsParsed.bucket,
        s3HttpsParsed.key,
      );
    }

    // 기타 URL (presigned 등) — 직접 fetch
    const response = await fetch(transcriptUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }
    return response.text();
  }

  private isTranscribeResultJson(
    value: unknown,
  ): value is TranscribeResultJson {
    return typeof value === 'object' && value !== null;
  }

  private parseS3HttpsUrl(url: string): { bucket: string; key: string } | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('.amazonaws.com')) {
        return null;
      }

      // 형식 1: https://s3.{region}.amazonaws.com/{bucket}/{key}
      if (
        parsed.hostname.startsWith('s3.') ||
        parsed.hostname === 's3.amazonaws.com'
      ) {
        const pathParts = parsed.pathname.slice(1).split('/');
        if (pathParts.length < 2) return null;
        const bucket = pathParts[0];
        const key = pathParts.slice(1).join('/');
        return { bucket, key };
      }

      // 형식 2: https://{bucket}.s3.{region}.amazonaws.com/{key}
      const hostParts = parsed.hostname.split('.s3.');
      if (hostParts.length === 2) {
        const bucket = hostParts[0];
        const key = parsed.pathname.slice(1);
        return { bucket, key };
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseS3Uri(uri: string): { bucket: string; key: string } | null {
    if (!uri.startsWith('s3://')) {
      return null;
    }

    const withoutProtocol = uri.slice(5);
    const slashIndex = withoutProtocol.indexOf('/');
    if (slashIndex <= 0 || slashIndex === withoutProtocol.length - 1) {
      return null;
    }

    return {
      bucket: withoutProtocol.slice(0, slashIndex),
      key: withoutProtocol.slice(slashIndex + 1),
    };
  }

  private async deleteAudioFile(mediaUri: string): Promise<void> {
    try {
      if (mediaUri.startsWith('s3://')) {
        const withoutProtocol = mediaUri.slice(5);
        const slashIndex = withoutProtocol.indexOf('/');
        const key = withoutProtocol.slice(slashIndex + 1);
        await this.s3AudioService.deleteAudioFile(key);
        this.logger.log(`Deleted audio file: ${key}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete audio file ${mediaUri}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async updateMeetingStatus(meetingId: string): Promise<void> {
    try {
      await this.meetingService.updateStatus(
        meetingId,
        MeetingStatus.COMPLETED,
      );
      this.logger.log(`Meeting ${meetingId} status updated to COMPLETED`);
    } catch (error) {
      this.logger.warn(
        `Failed to update meeting status for ${meetingId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async triggerResultGeneration(meetingId: string): Promise<void> {
    try {
      await this.resultService.generateForPipeline(meetingId);
      this.logger.log(`Result auto-generated for meeting ${meetingId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to auto-generate result for meeting ${meetingId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async finalizeAfterFailedTranscription(
    meetingId: string,
    mediaUri: string,
  ): Promise<void> {
    await this.deleteAudioFile(mediaUri);
    this.emitGeneratingPhase(meetingId);
    await this.triggerResultGeneration(meetingId);
    await this.updateMeetingStatus(meetingId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 'generating' phase 이벤트 핸들러.
   * 실시간 모드에서 회의 종료 시 complete()가 PROCESSING + 'generating'을 emit하면
   * 여기서 AI 결과 생성 + COMPLETED 전환을 처리합니다.
   */
  @OnEvent(MeetingStatusChangedEvent.EVENT_NAME, { async: true })
  async handleGeneratingPhase(event: MeetingStatusChangedEvent): Promise<void> {
    if (event.phase !== 'generating') return;

    this.logger.log(
      `Generating result for meeting ${event.meetingId} (realtime mode)`,
    );

    try {
      await this.triggerResultGeneration(event.meetingId);
      await this.updateMeetingStatus(event.meetingId);
    } catch (error) {
      this.logger.error(
        `Failed to generate result for meeting ${event.meetingId}: ${error instanceof Error ? error.message : error}`,
      );
      // 실패해도 COMPLETED로 전환 (사용자가 결과 페이지에서 재생성 가능)
      await this.updateMeetingStatus(event.meetingId);
    }
  }

  private emitGeneratingPhase(meetingId: string): void {
    this.eventEmitter.emit(
      MeetingStatusChangedEvent.EVENT_NAME,
      new MeetingStatusChangedEvent(
        meetingId,
        MeetingStatus.PROCESSING,
        'generating',
      ),
    );
  }
}
