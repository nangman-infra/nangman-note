/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ResultEntity } from '../../result/domain/result.entity';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
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
            transcriptionMode: MeetingTranscriptionMode.BATCH,
          },
        });

        const candidates = stalledMeetings.filter(
          (meeting) =>
            !meeting.deletedAt &&
            Boolean(meeting.endedAt) &&
            (meeting.endedAt as Date).getTime() <= threshold.getTime(),
        );

        for (const meeting of candidates) {
          await this.recoverMeeting(meeting, threshold);
        }
      });
    } finally {
      this.isRecovering = false;
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
