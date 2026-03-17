import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { TranscriptionUploadEntity } from '../domain/transcription-upload.entity';
import { TranscriptionUploadStatus } from '../domain/transcription-upload-status.enum';
import { TranscriptionService } from './transcription.service';
import { runWithRequestContext } from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

const RECONCILIATION_INTERVAL_MS = 30 * 1000;
const RECONCILIATION_MIN_AGE_MS = 15 * 1000;
const RECONCILIATION_LOCK_KEY = 74_274_002;

@Injectable()
export class PendingUploadReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new StructuredLogger(
    PendingUploadReconciliationService.name,
  );
  private reconciliationInterval: NodeJS.Timeout | null = null;
  private isReconciling = false;

  constructor(
    @InjectRepository(TranscriptionUploadEntity)
    private readonly transcriptionUploadRepository: Repository<TranscriptionUploadEntity>,
    private readonly transcriptionService: TranscriptionService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reconcilePendingUploads();
    this.reconciliationInterval = setInterval(() => {
      void this.reconcilePendingUploads();
    }, RECONCILIATION_INTERVAL_MS);
    this.reconciliationInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }
  }

  private async reconcilePendingUploads(): Promise<void> {
    if (this.isReconciling) {
      return;
    }

    this.isReconciling = true;
    try {
      await this.withReconciliationLock(async () => {
        const threshold = new Date(Date.now() - RECONCILIATION_MIN_AGE_MS);
        const pendingUploads = await this.transcriptionUploadRepository.find({
          where: {
            status: In([
              TranscriptionUploadStatus.ISSUED,
              TranscriptionUploadStatus.UPLOADED,
            ]),
          },
          relations: {
            meeting: true,
          },
          order: { createdAt: 'ASC' },
          take: 100,
        });

        for (const upload of pendingUploads) {
          if (
            upload.createdAt.getTime() > threshold.getTime() ||
            !this.shouldReconcile(upload.meeting)
          ) {
            continue;
          }
          await this.reconcileUpload(upload);
        }
      });
    } finally {
      this.isReconciling = false;
    }
  }

  private shouldReconcile(meeting?: MeetingEntity): boolean {
    if (!meeting || meeting.deletedAt) {
      return false;
    }

    return (
      meeting.status === MeetingStatus.PROCESSING &&
      meeting.transcriptionMode === MeetingTranscriptionMode.BATCH
    );
  }

  private async reconcileUpload(
    upload: TranscriptionUploadEntity,
  ): Promise<void> {
    const meeting = upload.meeting;
    await runWithRequestContext(
      {
        transport: 'job',
        meetingId: upload.meetingId,
        ownerSub: meeting.ownerSub,
      },
      async () => {
        try {
          const result =
            await this.transcriptionService.reconcilePendingBatchUpload(
              upload.meetingId,
              upload.id,
              meeting.ownerSub,
            );
          if (result.queued) {
            this.logger.log('transcription.batch.upload.reconciled', {
              meetingId: upload.meetingId,
              uploadId: upload.id,
              jobId: result.jobId,
            });
          }
        } catch (error) {
          this.logger.warn('transcription.batch.upload.reconcile_failed', {
            meetingId: upload.meetingId,
            uploadId: upload.id,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    );
  }

  private async withReconciliationLock(task: () => Promise<void>): Promise<void> {
    const dbType = this.dataSource.options.type;
    if (dbType !== 'postgres') {
      await task();
      return;
    }

    const rows = (await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [RECONCILIATION_LOCK_KEY],
    )) as Array<{ locked?: boolean }>;

    if (!rows[0]?.locked) {
      this.logger.debug('transcription.batch.upload.reconcile_lock_skipped', {
        lockKey: RECONCILIATION_LOCK_KEY,
      });
      return;
    }

    try {
      await task();
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock($1)', [
        RECONCILIATION_LOCK_KEY,
      ]);
    }
  }
}
