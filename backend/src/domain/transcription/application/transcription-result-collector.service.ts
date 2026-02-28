import { Inject, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(TranscriptionResultCollectorService.name);

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
        const result = await this.batchProvider.getJobStatus(
          job.providerJobId,
        );

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

          // Meeting 상태 변경
          await this.updateMeetingStatus(meetingId);

          // AI 결과물 자동 생성
          await this.triggerResultGeneration(meetingId);

          return { success: true, segmentCount };
        }

        if (result.status === TranscriptionJobStatus.FAILED) {
          this.logger.error(
            `Transcription job ${job.providerJobId} failed: ${result.errorMessage}`,
          );
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
      const parsed: TranscribeResultJson = JSON.parse(jsonContent);

      const items = parsed.results?.items ?? [];
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
      const confidence = parseFloat(item.alternatives?.[0]?.confidence ?? '0.9');
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
      const withoutProtocol = transcriptUri.slice(5);
      const slashIndex = withoutProtocol.indexOf('/');
      const key = withoutProtocol.slice(slashIndex + 1);
      return this.s3AudioService.getObjectAsString(key);
    }

    // HTTPS URL (AWS가 직접 제공하는 presigned URL)
    const response = await fetch(transcriptUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }
    return response.text();
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
      await this.meetingService.updateStatus(meetingId, MeetingStatus.COMPLETED);
      this.logger.log(`Meeting ${meetingId} status updated to COMPLETED`);
    } catch (error) {
      this.logger.warn(
        `Failed to update meeting status for ${meetingId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async triggerResultGeneration(meetingId: string): Promise<void> {
    try {
      // findByMeetingId는 결과가 없으면 자동으로 generateAndSave를 호출함
      await this.resultService.findByMeetingId(meetingId);
      this.logger.log(`Result auto-generated for meeting ${meetingId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to auto-generate result for meeting ${meetingId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}