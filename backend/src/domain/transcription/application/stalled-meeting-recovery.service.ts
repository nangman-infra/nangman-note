/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ResultEntity } from '../../result/domain/result.entity';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingProcessingPhase } from '../../meeting/domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { MeetingService } from '../../meeting/application/meeting.service';
import { TranscriptionService } from './transcription.service';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';
import { runWithRequestContext } from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

const STALLED_THRESHOLD_MS = 60 * 60 * 1000;
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
/** 브라우저 강제 종료 등으로 종료 API가 호출되지 못한 RECORDING 회의의 자동 마감 임계 */
const ABANDONED_RECORDING_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const POSTGRES_LOCK_KEY = 74_274_001;

@Injectable()
export class StalledMeetingRecoveryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new StructuredLogger(
    StalledMeetingRecoveryService.name,
  );
  private recoveryInterval: NodeJS.Timeout | null = null;
  private isRecovering = false;

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    @InjectRepository(TranscriptionUploadEntity)
    private readonly transcriptionUploadRepository: Repository<TranscriptionUploadEntity>,
    private readonly meetingService: MeetingService,
    private readonly transcriptionService: TranscriptionService,
    private readonly transcriptionResultCollectorService: TranscriptionResultCollectorService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverStalledMeetings();
    this.recoveryInterval = setInterval(() => {
      void this.recoverStalledMeetings();
    }, RECOVERY_INTERVAL_MS);
    this.recoveryInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }

  private async recoverStalledMeetings(): Promise<void> {
    if (this.isRecovering) {
      return;
    }

    this.isRecovering = true;
    try {
      await this.withRecoveryLock(async () => {
        const threshold = new Date(Date.now() - STALLED_THRESHOLD_MS);
        const stalledMeetings = await this.meetingRepository.find({
          where: {
            status: MeetingStatus.PROCESSING,
          },
        });

        const candidates = stalledMeetings.filter(
          (meeting) =>
            !meeting.deletedAt &&
            Boolean(meeting.endedAt) &&
            (meeting.endedAt as Date).getTime() <= threshold.getTime(),
        );

        for (const meeting of candidates) {
          if (meeting.transcriptionMode === MeetingTranscriptionMode.BATCH) {
            await this.recoverMeeting(meeting, threshold);
          } else {
            // 실시간 회의: 전사는 이미 DB에 있고 결과 생성만 고착된 상태.
            // 이전에는 BATCH만 스캔해 실시간 회의는 영구 고착됐다.
            await this.recoverRealtimeMeeting(meeting);
          }
        }

        await this.recoverAbandonedRecordingMeetings();
        await this.recoverStalledRegeneratingMeetings();
      });
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * 재생성 도중 서버가 재시작되어 processing_phase='regenerating'이
   * 영구 잔존한 회의를 정리합니다. (재생성 락이 in-process라 유실됨)
   */
  private async recoverStalledRegeneratingMeetings(): Promise<void> {
    const REGENERATING_STALE_MS = 30 * 60 * 1000;
    const threshold = new Date(Date.now() - REGENERATING_STALE_MS);

    const regenerating = await this.meetingRepository.find({
      where: {
        processingPhase: MeetingProcessingPhase.REGENERATING,
      },
    });

    const stalled = regenerating.filter(
      (meeting) =>
        !meeting.deletedAt &&
        meeting.updatedAt.getTime() <= threshold.getTime(),
    );

    for (const meeting of stalled) {
      await runWithRequestContext(
        {
          transport: 'job',
          meetingId: meeting.id,
          ownerSub: meeting.ownerSub,
        },
        async () => {
          this.logger.warn('meeting.recovery.stalled_regeneration_cleared', {
            meetingId: meeting.id,
            updatedAt: meeting.updatedAt,
          });
          try {
            await this.meetingService.updateProcessingPhase(
              meeting.id,
              null,
              meeting.ownerSub,
              { status: MeetingStatus.COMPLETED },
            );
          } catch (error) {
            this.logger.error(
              'meeting.recovery.stalled_regeneration_clear_failed',
              error,
              { meetingId: meeting.id },
            );
          }
        },
      );
    }
  }

  /**
   * 실시간 모드 회의가 PROCESSING에 갇힌 경우 복구.
   * (결과 생성이 in-process 이벤트 핸들러라 서버 재시작 시 유실됨)
   */
  private async recoverRealtimeMeeting(meeting: MeetingEntity): Promise<void> {
    await runWithRequestContext(
      {
        transport: 'job',
        meetingId: meeting.id,
        ownerSub: meeting.ownerSub,
      },
      async () => {
        const existingResult = await this.resultRepository.findOne({
          where: { meetingId: meeting.id },
        });
        if (existingResult) {
          this.logger.warn('meeting.recovery.result_exists_marking_completed', {
            meetingId: meeting.id,
          });
          await this.meetingService.updateStatus(
            meeting.id,
            MeetingStatus.COMPLETED,
          );
          return;
        }

        this.logger.warn('meeting.recovery.realtime_generation_stalled', {
          meetingId: meeting.id,
        });
        await this.transcriptionResultCollectorService.retriggerGenerationIfStuck(
          meeting.id,
          meeting.ownerSub,
        );
      },
    );
  }

  /**
   * 브라우저 강제 종료·기기 꺼짐 등으로 종료 API가 호출되지 못해
   * RECORDING 상태로 방치된 좀비 회의를 자동 마감합니다.
   * 노트·실시간 세그먼트 등 이미 저장된 데이터 기반으로 결과를 생성합니다.
   */
  private async recoverAbandonedRecordingMeetings(): Promise<void> {
    const threshold = new Date(Date.now() - ABANDONED_RECORDING_THRESHOLD_MS);
    const recordingMeetings = await this.meetingRepository.find({
      where: { status: MeetingStatus.RECORDING },
    });

    const abandoned = recordingMeetings.filter(
      (meeting) =>
        !meeting.deletedAt &&
        Boolean(meeting.startedAt) &&
        meeting.startedAt.getTime() <= threshold.getTime() &&
        meeting.updatedAt.getTime() <= threshold.getTime(),
    );

    for (const meeting of abandoned) {
      await runWithRequestContext(
        {
          transport: 'job',
          meetingId: meeting.id,
          ownerSub: meeting.ownerSub,
        },
        async () => {
          this.logger.warn('meeting.recovery.abandoned_recording', {
            meetingId: meeting.id,
            startedAt: meeting.startedAt,
          });
          try {
            await this.meetingService.complete(
              meeting.id,
              { skipTranscription: true, markAttentionRequired: true },
              meeting.ownerSub,
            );
          } catch (error) {
            this.logger.error(
              'meeting.recovery.abandoned_recording_failed',
              error,
              { meetingId: meeting.id },
            );
          }
        },
      );
    }
  }

  private async recoverMeeting(
    meeting: MeetingEntity,
    threshold: Date,
  ): Promise<void> {
    await runWithRequestContext(
      {
        transport: 'job',
        meetingId: meeting.id,
        ownerSub: meeting.ownerSub,
      },
      async () => {
        const existingResult = await this.resultRepository.findOne({
          where: { meetingId: meeting.id },
        });
        if (existingResult) {
          this.logger.warn('meeting.recovery.result_exists_marking_completed', {
            meetingId: meeting.id,
          });
          await this.meetingService.updateStatus(
            meeting.id,
            MeetingStatus.COMPLETED,
          );
          return;
        }

        const latestJob = await this.transcriptionJobRepository.findOne({
          where: { meetingId: meeting.id },
          order: { createdAt: 'DESC' },
        });

        if (!latestJob) {
          const latestUpload = await this.transcriptionUploadRepository.findOne(
            {
              where: { meetingId: meeting.id },
              order: { createdAt: 'DESC' },
            },
          );
          if (latestUpload) {
            this.logger.warn('meeting.recovery.pending_upload_detected', {
              meetingId: meeting.id,
              uploadId: latestUpload.id,
              uploadStatus: latestUpload.status,
            });
            try {
              const recovery =
                await this.transcriptionService.recoverPendingBatchUpload(
                  meeting.id,
                  latestUpload.id,
                  meeting.ownerSub,
                );
              if (recovery.queued) {
                return;
              }
              if (!recovery.objectPresent) {
                await this.transcriptionResultCollectorService.recoverMissingBatchJob(
                  meeting.id,
                  meeting.ownerSub,
                );
                return;
              }
            } catch (error) {
              this.logger.error(
                'meeting.recovery.pending_upload_failed',
                error,
                {
                  meetingId: meeting.id,
                  uploadId: latestUpload.id,
                },
              );
              await this.transcriptionResultCollectorService.recoverMissingBatchJob(
                meeting.id,
                meeting.ownerSub,
              );
              return;
            }
          }

          this.logger.warn('meeting.recovery.missing_transcription_job', {
            meetingId: meeting.id,
          });
          await this.transcriptionResultCollectorService.recoverMissingBatchJob(
            meeting.id,
            meeting.ownerSub,
          );
          return;
        }

        if (!this.shouldRecoverJob(latestJob, threshold)) {
          return;
        }

        this.logger.warn('meeting.recovery.stalled_transcription_job', {
          meetingId: meeting.id,
          jobId: latestJob.id,
          transcriptionJobStatus: latestJob.status,
          providerJobId: latestJob.providerJobId,
        });
        await this.transcriptionResultCollectorService.recoverStalledBatchJob(
          meeting.id,
          latestJob.id,
          meeting.ownerSub,
        );
      },
    );
  }

  private shouldRecoverJob(
    latestJob: TranscriptionJobEntity,
    threshold: Date,
  ): boolean {
    if (
      latestJob.status === TranscriptionJobStatus.COMPLETED ||
      latestJob.status === TranscriptionJobStatus.FAILED
    ) {
      return true;
    }

    if (
      (latestJob.status === TranscriptionJobStatus.QUEUED ||
        latestJob.status === TranscriptionJobStatus.PROCESSING) &&
      latestJob.updatedAt.getTime() <= threshold.getTime()
    ) {
      return true;
    }

    return false;
  }

  private async withRecoveryLock(task: () => Promise<void>): Promise<void> {
    const dbType = this.dataSource.options.type;
    if (dbType !== 'postgres') {
      await task();
      return;
    }

    const rows = await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [POSTGRES_LOCK_KEY],
    );

    if (!rows[0]?.locked) {
      this.logger.debug('meeting.recovery.lock_skipped', {
        lockKey: POSTGRES_LOCK_KEY,
      });
      return;
    }

    try {
      await task();
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock($1)', [
        POSTGRES_LOCK_KEY,
      ]);
    }
  }
}
