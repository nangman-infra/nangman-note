import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BATCH_TRANSCRIPTION_PROVIDER,
  type BatchTranscriptionProvider,
} from './ports/batch-transcription-provider.port';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingProcessingPhase } from '../../meeting/domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { ResultService } from '../../result/application/result.service';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';
import {
  runWithRequestContext,
  type RequestContextStore,
} from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

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
  speaker_label?: string;
}

interface TranscribeSpeakerSegmentItem {
  start_time: string;
  end_time: string;
  speaker_label: string;
}

interface TranscribeResultJson {
  results?: {
    items?: TranscribeResultItem[];
    transcripts?: Array<{ transcript?: string }>;
    speaker_labels?: {
      speakers?: number;
      segments?: Array<{
        start_time: string;
        end_time: string;
        speaker_label: string;
        items?: TranscribeSpeakerSegmentItem[];
      }>;
    };
  };
}

@Injectable()
export class TranscriptionResultCollectorService {
  private readonly logger = new StructuredLogger(
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
  ) {}

  /**
   * 배치 전사 잡 완료를 폴링하고, 결과를 파싱하여 DB에 저장합니다.
   * 완료 후 오디오 파일을 삭제하고 Meeting 상태를 COMPLETED로 변경합니다.
   */
  async pollAndCollect(
    meetingId: string,
    jobId: string,
  ): Promise<{ success: boolean; segmentCount: number }> {
    let meetingOwnerSub: string | undefined;
    try {
      const meeting = await this.meetingService.findById(meetingId);
      meetingOwnerSub = meeting.ownerSub;
    } catch {
      meetingOwnerSub = undefined;
    }

    return runWithRequestContext(
      {
        transport: 'job',
        meetingId,
        jobId,
        ownerSub: meetingOwnerSub,
      },
      async () => {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
          this.logger.error('transcription.batch.job.missing', new Error('Transcription job not found'), {
            meetingId,
            jobId,
          });
          return { success: false, segmentCount: 0 };
        }

        const startTime = Date.now();

        while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
          try {
            const result = await this.batchProvider.getJobStatus(
              job.providerJobId,
            );

            job.status = result.status;
            if (result.transcriptUri) {
              job.transcriptUri = result.transcriptUri;
            }
            if (result.errorMessage) {
              job.errorMessage = result.errorMessage;
            }
            await this.jobRepository.save(job);

            if (result.status === TranscriptionJobStatus.COMPLETED) {
              this.logger.log('transcription.batch.job.completed', {
                meetingId,
                jobId,
                providerJobId: job.providerJobId,
              });

              const segmentCount = await this.parseAndSaveResults(
                meetingId,
                result.transcriptUri,
              );

              await this.deleteAudioFile(job.mediaUri);
              this.emitGeneratingPhase(meetingId, meetingOwnerSub);

              return { success: true, segmentCount };
            }

            if (result.status === TranscriptionJobStatus.FAILED) {
              this.logger.error(
                'transcription.batch.job.failed',
                new Error(result.errorMessage ?? 'Batch transcription job failed'),
                {
                  meetingId,
                  jobId,
                  providerJobId: job.providerJobId,
                },
              );
              await this.finalizeAfterFailedTranscription(
                meetingId,
                job.mediaUri,
                meetingOwnerSub,
              );
              return { success: false, segmentCount: 0 };
            }

            await this.sleep(POLL_INTERVAL_MS);
          } catch (error) {
            this.logger.error('transcription.batch.job.poll_failed', error, {
              meetingId,
              jobId,
              providerJobId: job.providerJobId,
            });
            await this.sleep(POLL_INTERVAL_MS);
          }
        }

        job.status = TranscriptionJobStatus.FAILED;
        job.errorMessage = `Polling timed out after ${MAX_POLL_DURATION_MS / 1000}s`;
        await this.jobRepository.save(job);

        this.logger.error(
          'transcription.batch.job.timed_out',
          new Error(job.errorMessage),
          {
            meetingId,
            jobId,
            providerJobId: job.providerJobId,
          },
        );
        await this.finalizeAfterFailedTranscription(
          meetingId,
          job.mediaUri,
          meetingOwnerSub,
        );
        return { success: false, segmentCount: 0 };
      },
    );
  }

  async recoverMissingBatchJob(
    meetingId: string,
    ownerSub?: string,
  ): Promise<void> {
    await runWithRequestContext(
      {
        transport: 'job',
        meetingId,
        ownerSub,
      },
      async () => {
        this.logger.warn('transcription.batch.job.recover_missing', {
          meetingId,
          ownerSub,
        });
        await this.meetingService.markNeedsAttention(meetingId, ownerSub);
        await this.emitGeneratingPhase(meetingId, ownerSub);
      },
    );
  }

  async recoverStalledBatchJob(
    meetingId: string,
    jobId: string,
    ownerSub?: string,
  ): Promise<{ success: boolean; segmentCount: number }> {
    return runWithRequestContext(
      {
        transport: 'job',
        meetingId,
        jobId,
        ownerSub,
      },
      async () => {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
          this.logger.warn('transcription.batch.job.recover_missing_record', {
            meetingId,
            jobId,
            ownerSub,
          });
          await this.meetingService.markNeedsAttention(meetingId, ownerSub);
          await this.emitGeneratingPhase(meetingId, ownerSub);
          return { success: false, segmentCount: 0 };
        }

        try {
          const result = await this.batchProvider.getJobStatus(
            job.providerJobId,
          );

          job.status = result.status;
          if (result.transcriptUri) {
            job.transcriptUri = result.transcriptUri;
          }
          if (result.errorMessage) {
            job.errorMessage = result.errorMessage;
          }
          await this.jobRepository.save(job);

          if (result.status === TranscriptionJobStatus.COMPLETED) {
            this.logger.log('transcription.batch.job.recovered_completed', {
              meetingId,
              jobId,
              providerJobId: job.providerJobId,
            });
            const segmentCount = await this.parseAndSaveResults(
              meetingId,
              result.transcriptUri,
            );
            await this.deleteAudioFile(job.mediaUri);
            await this.emitGeneratingPhase(meetingId, ownerSub);
            return { success: true, segmentCount };
          }

          if (result.status === TranscriptionJobStatus.FAILED) {
            this.logger.warn('transcription.batch.job.recovered_failed', {
              meetingId,
              jobId,
              providerJobId: job.providerJobId,
              errorMessage: result.errorMessage,
            });
            await this.finalizeAfterFailedTranscription(
              meetingId,
              job.mediaUri,
              ownerSub,
            );
            return { success: false, segmentCount: 0 };
          }
        } catch (error) {
          this.logger.warn('transcription.batch.job.recovery_recheck_failed', {
            meetingId,
            jobId,
            providerJobId: job.providerJobId,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }

        job.status = TranscriptionJobStatus.FAILED;
        job.errorMessage = 'Batch transcription stalled for over 1 hour';
        await this.jobRepository.save(job);
        this.logger.warn('transcription.batch.job.marked_failed_after_stall', {
          meetingId,
          jobId,
          providerJobId: job.providerJobId,
        });
        await this.finalizeAfterFailedTranscription(
          meetingId,
          job.mediaUri,
          ownerSub,
        );
        return { success: false, segmentCount: 0 };
      },
    );
  }

  private async parseAndSaveResults(
    meetingId: string,
    transcriptUri?: string,
  ): Promise<number> {
    if (!transcriptUri) {
      this.logger.warn('transcription.batch.transcript_uri.missing', {
        meetingId,
      });
      return 0;
    }

    try {
      // transcriptUri는 S3 URI (s3://bucket/key) 또는 HTTPS URL
      const jsonContent = await this.fetchTranscriptJson(transcriptUri);
      const parsedUnknown: unknown = JSON.parse(jsonContent);
      if (!this.isTranscribeResultJson(parsedUnknown)) {
        this.logger.warn('transcription.batch.transcript_shape.invalid', {
          meetingId,
        });
        return 0;
      }

      const items = parsedUnknown.results?.items ?? [];
      const speakerLookup = this.buildSpeakerLookup(parsedUnknown);
      const segments = this.itemsToSegments(meetingId, items, speakerLookup);

      if (segments.length > 0) {
        await this.segmentRepository.save(segments);
        this.logger.log('transcription.segment.saved', {
          meetingId,
          segmentCount: segments.length,
        });
      }

      return segments.length;
    } catch (error) {
      this.logger.error('transcription.batch.transcript_parse_failed', error, {
        meetingId,
        transcriptUri,
      });
      return 0;
    }
  }

  /**
   * speaker_labels.segments[].items[]에서 start_time → speaker_label 룩업 맵 생성.
   * AWS 배치 결과에서 speaker_label은 items[] 배열이 아닌 별도 speaker_labels 구조에 있음.
   */
  private buildSpeakerLookup(
    parsed: TranscribeResultJson,
  ): Map<string, string> {
    const lookup = new Map<string, string>();
    const speakerSegments = parsed.results?.speaker_labels?.segments ?? [];

    for (const seg of speakerSegments) {
      for (const item of seg.items ?? []) {
        lookup.set(item.start_time, item.speaker_label);
      }
    }

    return lookup;
  }

  private itemsToSegments(
    meetingId: string,
    items: TranscribeResultItem[],
    speakerLookup?: Map<string, string>,
  ): TranscriptSegmentEntity[] {
    const segments: TranscriptSegmentEntity[] = [];
    let currentText = '';
    let currentStartTime = 0;
    let currentEndTime = 0;
    let currentConfidence = 0;
    let currentSpeaker: string | undefined;
    let wordCount = 0;
    let lastPunctuationIsSentenceEnd = false;

    const flushSegment = () => {
      if (currentText.trim().length > 0 && wordCount > 0) {
        const segment = this.segmentRepository.create({
          meetingId,
          startTime: currentStartTime,
          endTime: currentEndTime,
          text: currentText.trim(),
          confidence: currentConfidence / wordCount,
          speakerLabel: currentSpeaker,
        });
        segments.push(segment);
      }
      currentText = '';
      currentConfidence = 0;
      wordCount = 0;
      lastPunctuationIsSentenceEnd = false;
    };

    for (const item of items) {
      if (item.type === 'punctuation') {
        const content = item.alternatives?.[0]?.content ?? '';
        currentText += content;
        lastPunctuationIsSentenceEnd = /[.?!]/.test(content);

        // 문장 종결 구두점에서 분할 (wordCount > 0이면)
        if (lastPunctuationIsSentenceEnd && wordCount > 0) {
          flushSegment();
        }
        continue;
      }

      // pronunciation (단어)
      const content = item.alternatives?.[0]?.content ?? '';
      const confidence = parseFloat(
        item.alternatives?.[0]?.confidence ?? '0.9',
      );
      const startTime = parseFloat(item.start_time ?? '0');
      const endTime = parseFloat(item.end_time ?? '0');
      const speakerLabel =
        speakerLookup?.get(item.start_time ?? '') ?? undefined;

      // 화자 전환 시 분할
      if (
        speakerLabel &&
        currentSpeaker &&
        speakerLabel !== currentSpeaker &&
        wordCount > 0
      ) {
        flushSegment();
      }

      if (wordCount === 0) {
        currentStartTime = startTime;
        currentSpeaker = speakerLabel;
      }

      currentText += (currentText.length > 0 ? ' ' : '') + content;
      currentEndTime = endTime;
      currentConfidence += confidence;
      if (speakerLabel) {
        currentSpeaker = speakerLabel;
      }
      wordCount++;

      // 폴백: 20단어 또는 15초 (구두점/화자 전환이 없는 긴 발화 대응)
      if (wordCount >= 20 || endTime - currentStartTime >= 15) {
        flushSegment();
      }
    }

    // 남은 텍스트
    flushSegment();

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
      this.logger.debug('transcription.batch.transcript_fetching_via_sdk', {
        bucket: s3HttpsParsed.bucket,
        key: s3HttpsParsed.key,
      });
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
        this.logger.log('transcription.audio.deleted', {
          key,
        });
      }
    } catch (error) {
      this.logger.warn('transcription.audio.delete_failed', {
        mediaUri,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async updateMeetingStatus(
    meetingId: string,
    options?: { needsAttention?: boolean },
  ): Promise<void> {
    try {
      const meeting = await this.meetingService.updateStatus(
        meetingId,
        MeetingStatus.COMPLETED,
      );
      if (options?.needsAttention && !meeting.needsAttention) {
        await this.meetingService.markNeedsAttention(meetingId);
      }
      this.logger.log('meeting.status.completed_after_transcription', {
        meetingId,
        needsAttention: Boolean(options?.needsAttention),
      });
    } catch (error) {
      this.logger.warn('meeting.status.complete_failed', {
        meetingId,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async triggerResultGeneration(meetingId: string): Promise<void> {
    try {
      await this.resultService.generateForPipeline(meetingId);
      this.logger.log('result.auto_generated', {
        meetingId,
      });
    } catch (error) {
      this.logger.warn('result.auto_generate_failed', {
        meetingId,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async finalizeAfterFailedTranscription(
    meetingId: string,
    mediaUri: string,
    ownerSub?: string,
  ): Promise<void> {
    await this.deleteAudioFile(mediaUri);
    await this.meetingService.markNeedsAttention(meetingId, ownerSub);
    await this.emitGeneratingPhase(meetingId, ownerSub);
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

    this.logger.log('result.generation.phase_started', {
      meetingId: event.meetingId,
      ownerSub: event.ownerSub,
      phase: event.phase,
    });

    try {
      await this.triggerResultGeneration(event.meetingId);
      await this.updateMeetingStatus(event.meetingId, {
        needsAttention: event.needsAttention,
      });
    } catch (error) {
      this.logger.error('result.generation.phase_failed', error, {
        meetingId: event.meetingId,
        ownerSub: event.ownerSub,
        phase: event.phase,
      });
      // 실패해도 COMPLETED로 전환 (사용자가 결과 페이지에서 재생성 가능)
      await this.updateMeetingStatus(event.meetingId, {
        needsAttention: true,
      });
    }
  }

  private async emitGeneratingPhase(
    meetingId: string,
    ownerSub?: string,
  ): Promise<void> {
    const updated = await this.meetingService.updateProcessingPhase(
      meetingId,
      MeetingProcessingPhase.GENERATING,
      ownerSub,
      { status: MeetingStatus.PROCESSING },
    );
    this.logger.log('meeting.phase.generating.emitted', {
      meetingId,
      ownerSub,
      needsAttention: updated.needsAttention,
    });
  }
}
