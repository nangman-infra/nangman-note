import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import {
  BATCH_TRANSCRIPTION_PROVIDER,
  type BatchTranscriptionProvider,
} from './ports/batch-transcription-provider.port';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingProcessingPhase } from '../../meeting/domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';
import { ResultService } from '../../result/application/result.service';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';
import { runWithRequestContext } from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

const POLL_INTERVAL_MS = 5_000; // 5초
/**
 * 인프로세스 폴링 최대 시간.
 * AWS Transcribe 배치 잡은 오디오 길이에 비례해 오래 걸릴 수 있으므로
 * (최대 입력 4시간) 짧은 타임아웃으로 강제 실패 처리하면 안 됩니다.
 * 이 시간을 초과하면 잡을 실패로 마킹하지 않고 폴링만 중단하며,
 * 이후 StalledMeetingRecoveryService가 폴링을 재개합니다.
 */
const MAX_POLL_DURATION_MS = 4 * 60 * 60 * 1000; // 4시간
/** 이 시간이 지나도 provider가 완료/실패를 반환하지 않으면 잡을 최종 실패 처리 */
const MAX_JOB_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6시간
const JOB_COLLECTION_LOCK_PREFIX = 'transcription-job-collection';

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
export class TranscriptionResultCollectorService implements OnModuleInit {
  private readonly logger = new StructuredLogger(
    TranscriptionResultCollectorService.name,
  );

  constructor(
    @InjectRepository(TranscriptionJobEntity)
    private readonly jobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly segmentRepository: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionUploadEntity)
    private readonly uploadRepository: Repository<TranscriptionUploadEntity>,
    @Inject(BATCH_TRANSCRIPTION_PROVIDER)
    private readonly batchProvider: BatchTranscriptionProvider,
    private readonly meetingService: MeetingService,
    private readonly resultService: ResultService,
    private readonly s3AudioService: S3AudioService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 서버 재시작으로 죽은 인프로세스 폴링 루프를 부팅 시 재개합니다.
   * (이전에는 재배포 후 잡이 QUEUED/PROCESSING인 채 방치되어
   * stalled recovery의 1시간 임계까지 사용자가 기다려야 했음)
   */
  async onModuleInit(): Promise<void> {
    try {
      const pendingJobs = await this.jobRepository.find({
        where: {
          status: In([
            TranscriptionJobStatus.QUEUED,
            TranscriptionJobStatus.PROCESSING,
          ]),
        },
      });

      for (const job of pendingJobs) {
        if (job.collectedAt) continue;
        this.logger.log('transcription.batch.poll.resumed_on_boot', {
          meetingId: job.meetingId,
          jobId: job.id,
          providerJobId: job.providerJobId,
        });
        this.resumePollingInBackground(job.meetingId, job.id);
      }
    } catch (error) {
      this.logger.warn('transcription.batch.poll.boot_resume_failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

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
          this.logger.error(
            'transcription.batch.job.missing',
            new Error('Transcription job not found'),
            {
              meetingId,
              jobId,
            },
          );
          return { success: false, segmentCount: 0 };
        }

        if (job.collectedAt) {
          this.logger.log('transcription.batch.job.collection_already_done', {
            meetingId,
            jobId,
          });
          // 수집 완료 후 결과 생성 전에 죽은 케이스 복구
          await this.retriggerGenerationIfStuck(meetingId, meetingOwnerSub);
          return { success: true, segmentCount: 0 };
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

              const segmentCount = await this.collectCompletedJob(
                job.id,
                result.transcriptUri,
                meetingOwnerSub,
              );

              return { success: true, segmentCount };
            }

            if (result.status === TranscriptionJobStatus.FAILED) {
              this.logger.error(
                'transcription.batch.job.failed',
                new Error(
                  result.errorMessage ?? 'Batch transcription job failed',
                ),
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

        // 폴링 시간 초과: 잡을 실패로 마킹하지 않는다.
        // AWS 잡이 아직 IN_PROGRESS일 수 있으므로 (긴 오디오),
        // 오디오/잡을 보존한 채 폴링만 중단하고 StalledMeetingRecoveryService에 위임한다.
        this.logger.warn('transcription.batch.job.poll_window_exhausted', {
          meetingId,
          jobId,
          providerJobId: job.providerJobId,
          pollDurationMs: MAX_POLL_DURATION_MS,
        });
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

        const jobAgeMs = Date.now() - job.createdAt.getTime();

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
            const segmentCount = await this.collectCompletedJob(
              job.id,
              result.transcriptUri,
              ownerSub,
            );
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

          // provider가 아직 QUEUED/PROCESSING을 반환: 잡이 진짜로 진행 중이므로
          // 강제 실패시키지 않고 폴링을 재개한다 (서버 재시작으로 폴링 루프가 죽은 케이스).
          if (jobAgeMs < MAX_JOB_LIFETIME_MS) {
            this.logger.log('transcription.batch.job.recovery_resume_polling', {
              meetingId,
              jobId,
              providerJobId: job.providerJobId,
              jobAgeMs,
            });
            this.resumePollingInBackground(meetingId, jobId);
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
          // 일시적 API 오류일 수 있으므로 잡 수명 내에서는 폴링을 재개한다.
          if (jobAgeMs < MAX_JOB_LIFETIME_MS) {
            this.resumePollingInBackground(meetingId, jobId);
            return { success: false, segmentCount: 0 };
          }
        }

        // 잡 수명(6시간) 초과: 최종 실패 처리 (오디오는 보존 — 재시도 가능성 유지)
        // 단, 이미 COMPLETED로 알고 있는 잡은 상태 조회 실패만으로 덮어쓰지 않는다.
        if (
          job.status === TranscriptionJobStatus.COMPLETED ||
          job.collectedAt
        ) {
          this.logger.warn(
            'transcription.batch.job.recovery_skip_completed_overwrite',
            { meetingId, jobId, providerJobId: job.providerJobId },
          );
          await this.retriggerGenerationIfStuck(meetingId, ownerSub);
          return { success: false, segmentCount: 0 };
        }

        job.status = TranscriptionJobStatus.FAILED;
        job.errorMessage = `Batch transcription did not finish within ${MAX_JOB_LIFETIME_MS / 3_600_000}h`;
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
    job: TranscriptionJobEntity,
    transcriptUri?: string,
  ): Promise<number> {
    const meetingId = job.meetingId;
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

      await this.mergeBatchSegments(job, segments);

      return segments.length;
    } catch (error) {
      this.logger.error('transcription.batch.transcript_parse_failed', error, {
        meetingId,
        transcriptUri,
      });
      return 0;
    }
  }

  private async collectCompletedJob(
    jobId: string,
    transcriptUri: string | undefined,
    ownerSub?: string,
  ): Promise<number> {
    return this.withJobCollectionLock(jobId, async () => {
      const job = await this.jobRepository.findOne({ where: { id: jobId } });
      if (!job) {
        this.logger.warn('transcription.batch.job.collection_missing_record', {
          jobId,
        });
        return 0;
      }

      if (job.collectedAt) {
        this.logger.log('transcription.batch.job.collection_skipped', {
          meetingId: job.meetingId,
          jobId,
        });
        // 수집은 끝났지만 결과 생성 전에 서버가 죽었을 수 있다.
        // 회의가 아직 PROCESSING이면 generating 단계를 재발화해 고착을 푼다.
        await this.retriggerGenerationIfStuck(job.meetingId, ownerSub);
        return 0;
      }

      const effectiveTranscriptUri = transcriptUri ?? job.transcriptUri;
      const segmentCount = await this.parseAndSaveResults(
        job,
        effectiveTranscriptUri,
      );

      job.status = TranscriptionJobStatus.COMPLETED;
      if (effectiveTranscriptUri) {
        job.transcriptUri = effectiveTranscriptUri;
      }
      job.errorMessage = null;
      job.collectedAt = new Date();
      await this.jobRepository.save(job);

      await this.deleteAudioFile(job.mediaUri);
      await this.emitGeneratingPhaseIfAllJobsSettled(job.meetingId, ownerSub);

      return segmentCount;
    });
  }

  /**
   * 세그먼트 수집은 끝났지만(collectedAt 존재) 결과 생성 전에 프로세스가 죽어
   * 회의가 PROCESSING에 갇힌 케이스를 복구합니다.
   * 이전에는 collectedAt이 있으면 아무 상태 전환 없이 리턴해 recovery가
   * 5분마다 무한 no-op을 반복하는 버그가 있었습니다.
   */
  async retriggerGenerationIfStuck(
    meetingId: string,
    ownerSub?: string,
  ): Promise<void> {
    try {
      const meeting = await this.meetingService.findById(meetingId, ownerSub);
      if (meeting.status !== MeetingStatus.PROCESSING) {
        return;
      }
      this.logger.warn('meeting.recovery.retrigger_generation', {
        meetingId,
        ownerSub,
        processingPhase: meeting.processingPhase,
      });
      await this.emitGeneratingPhaseIfAllJobsSettled(meetingId, ownerSub);
    } catch (error) {
      this.logger.warn('meeting.recovery.retrigger_generation_failed', {
        meetingId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 회의의 모든 배치 잡이 종결(수집 완료 또는 실패)됐을 때만 결과 생성 단계로
   * 진입합니다. 멀티 세션 녹음에서는 잡이 여러 개이므로, 첫 잡 완료 시점에
   * 결과를 생성하면 나머지 세션 전사가 회의록에서 누락됩니다.
   */
  private async emitGeneratingPhaseIfAllJobsSettled(
    meetingId: string,
    ownerSub?: string,
  ): Promise<void> {
    // 아직 녹음 중인 회의를 결과 생성으로 밀어내지 않는다
    try {
      const meeting = await this.meetingService.findById(meetingId, ownerSub);
      if (meeting.status === MeetingStatus.RECORDING) {
        this.logger.log('transcription.batch.generating_deferred_recording', {
          meetingId,
        });
        return;
      }
    } catch {
      // 회의 조회 실패 시 기존 동작 유지
    }

    const pendingCount = await this.jobRepository.count({
      where: {
        meetingId,
        status: In([
          TranscriptionJobStatus.QUEUED,
          TranscriptionJobStatus.PROCESSING,
        ]),
      },
    });

    if (pendingCount > 0) {
      this.logger.log('transcription.batch.generating_deferred', {
        meetingId,
        pendingJobCount: pendingCount,
      });
      return;
    }

    // 멀티 세션 순차 업로드 레이스 방지:
    // 아직 잡으로 확정되지 않은 최근 업로드(ISSUED/UPLOADED)가 있으면
    // 그 세션의 전사가 시작되기 전이므로 결과 생성을 유예한다.
    // 오래 방치된 업로드(탭 강제 종료 등)는 무한 대기하지 않도록 시간 제한.
    const PENDING_UPLOAD_WINDOW_MS = 15 * 60 * 1000;
    const pendingUploads = await this.uploadRepository.find({
      where: {
        meetingId,
        status: In([
          TranscriptionUploadStatus.ISSUED,
          TranscriptionUploadStatus.UPLOADED,
        ]),
      },
    });
    const recentPendingUploads = pendingUploads.filter(
      (upload) =>
        Date.now() - upload.createdAt.getTime() < PENDING_UPLOAD_WINDOW_MS,
    );
    if (recentPendingUploads.length > 0) {
      this.logger.log('transcription.batch.generating_deferred_uploads', {
        meetingId,
        pendingUploadCount: recentPendingUploads.length,
      });
      return;
    }

    await this.emitGeneratingPhase(meetingId, ownerSub);
  }

  private async withJobCollectionLock<T>(
    jobId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    if (this.dataSource.options.type !== 'postgres') {
      return task();
    }

    const lockKey = `${JOB_COLLECTION_LOCK_PREFIX}:${jobId}`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);

    try {
      return await task();
    } finally {
      await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [
        lockKey,
      ]);
      await queryRunner.release();
    }
  }

  /**
   * 배치 전사 결과를 기존 세그먼트와 병합 저장합니다.
   *
   * - 이 잡이 이전에 저장했던 세그먼트(transcription_job_id 일치)만 삭제해
   *   재수집 멱등성을 보장합니다.
   * - 실시간 폴백 세그먼트(job id가 null)와 다른 잡의 세그먼트는 보존합니다.
   * - 잡에 startOffsetSeconds가 있으면 그만큼, 없으면(레거시) 잡 생성 이전에
   *   저장된 세그먼트의 마지막 endTime만큼 시간 오프셋을 더해 하나의
   *   타임라인으로 정렬합니다.
   */
  private async mergeBatchSegments(
    job: TranscriptionJobEntity,
    segments: TranscriptSegmentEntity[],
  ): Promise<void> {
    const meetingId = job.meetingId;

    await this.dataSource.transaction(async (manager) => {
      // 이 잡의 이전 부분 수집 잔재만 삭제
      await manager.delete(TranscriptSegmentEntity, {
        meetingId,
        transcriptionJobId: job.id,
      });

      let offsetSeconds: number;
      if (
        job.startOffsetSeconds !== null &&
        job.startOffsetSeconds !== undefined
      ) {
        offsetSeconds = job.startOffsetSeconds;
      } else {
        // 레거시 폴백: 잡 생성 이전에 저장된(실시간 폴백) 세그먼트의 마지막 endTime
        const lastPreserved = await manager.find(TranscriptSegmentEntity, {
          where: {
            meetingId,
            createdAt: LessThan(job.createdAt),
          },
          select: ['endTime'],
          order: { endTime: 'DESC' },
          take: 1,
        });
        offsetSeconds = lastPreserved[0]?.endTime ?? 0;
      }

      for (const segment of segments) {
        segment.transcriptionJobId = job.id;
        if (offsetSeconds > 0) {
          segment.startTime += offsetSeconds;
          segment.endTime += offsetSeconds;
        }
      }

      if (segments.length > 0) {
        await manager.save(TranscriptSegmentEntity, segments);
      }

      this.logger.log('transcription.segment.merged', {
        meetingId,
        jobId: job.id,
        batchSegmentCount: segments.length,
        appliedOffsetSeconds: offsetSeconds,
      });
    });
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
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async finalizeAfterFailedTranscription(
    meetingId: string,
    mediaUri: string,
    ownerSub?: string,
  ): Promise<void> {
    // 원본 오디오는 삭제하지 않고 보존한다.
    // 일시적 장애로 실패한 경우 재시도(수동 복구·재큐잉)가 가능해야 하며,
    // 잔여 객체 정리는 S3 lifecycle 정책에 위임한다.
    this.logger.warn('transcription.audio.preserved_after_failure', {
      meetingId,
      mediaUri,
    });
    await this.meetingService.markNeedsAttention(meetingId, ownerSub);
    await this.emitGeneratingPhaseIfAllJobsSettled(meetingId, ownerSub);
  }

  /** 서버 재시작 등으로 죽은 폴링 루프를 백그라운드에서 재개합니다. */
  private resumePollingInBackground(meetingId: string, jobId: string): void {
    this.pollAndCollect(meetingId, jobId)
      .then((result) => {
        this.logger.log('transcription.batch.poll.resumed_completed', {
          meetingId,
          jobId,
          success: result.success,
          segmentCount: result.segmentCount,
        });
      })
      .catch((error: Error) => {
        this.logger.error('transcription.batch.poll.resume_failed', error, {
          meetingId,
          jobId,
        });
      });
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
    if (event.phase !== MeetingProcessingPhase.GENERATING) return;

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
