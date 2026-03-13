import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ResultEntity } from '../../result/domain/result.entity';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { MeetingService } from '../../meeting/application/meeting.service';
import { TranscriptionResultCollectorService } from './transcription-result-collector.service';

const STALLED_THRESHOLD_MS = 60 * 60 * 1000;
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
const POSTGRES_LOCK_KEY = 74_274_001;

@Injectable()
export class StalledMeetingRecoveryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(StalledMeetingRecoveryService.name);
  private recoveryInterval: NodeJS.Timeout | null = null;
  private isRecovering = false;

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepository: Repository<MeetingEntity>,
    @InjectRepository(ResultEntity)
    private readonly resultRepository: Repository<ResultEntity>,
    @InjectRepository(TranscriptionJobEntity)
    private readonly transcriptionJobRepository: Repository<TranscriptionJobEntity>,
    private readonly meetingService: MeetingService,
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
    const existingResult = await this.resultRepository.findOne({
      where: { meetingId: meeting.id },
    });
    if (existingResult) {
      this.logger.warn(
        `Meeting ${meeting.id} was stuck in processing despite having a result; marking completed`,
      );
      await this.meetingService.updateStatus(meeting.id, MeetingStatus.COMPLETED);
      return;
    }

    const latestJob = await this.transcriptionJobRepository.findOne({
      where: { meetingId: meeting.id },
      order: { createdAt: 'DESC' },
    });

    if (!latestJob) {
      this.logger.warn(
        `Recovering stalled batch meeting ${meeting.id} without a transcription job`,
      );
      await this.transcriptionResultCollectorService.recoverMissingBatchJob(
        meeting.id,
        meeting.ownerSub,
      );
      return;
    }

    if (!this.shouldRecoverJob(latestJob, threshold)) {
      return;
    }

    this.logger.warn(
      `Recovering stalled batch meeting ${meeting.id} using job ${latestJob.id}`,
    );
    await this.transcriptionResultCollectorService.recoverStalledBatchJob(
      meeting.id,
      latestJob.id,
      meeting.ownerSub,
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

    const rows = (await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [POSTGRES_LOCK_KEY],
    )) as Array<{ locked?: boolean }>;

    if (!rows[0]?.locked) {
      this.logger.debug(
        'Skipping stalled meeting recovery because another instance owns the lock',
      );
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
