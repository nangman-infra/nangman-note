import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { TranscriptionUploadStatus } from './transcription-upload-status.enum';

@Entity('transcription_upload')
@Index('IDX_transcription_upload_meeting_created', ['meetingId', 'createdAt'])
@Index('IDX_transcription_upload_meeting_status', ['meetingId', 'status'])
export class TranscriptionUploadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id', type: 'uuid' })
  meetingId: string;

  @Column({ type: 'varchar', length: 255 })
  bucket: string;

  @Column({ name: 's3_key', type: 'varchar', length: 2048 })
  s3Key: string;

  @Column({ name: 'media_uri', type: 'varchar', length: 2048 })
  mediaUri: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: TranscriptionUploadStatus.ISSUED,
  })
  status: TranscriptionUploadStatus;

  @Column({ name: 'content_type', type: 'varchar', length: 128 })
  contentType: string;

  @Column({ name: 'transcription_job_id', type: 'uuid', nullable: true })
  transcriptionJobId?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  @Column({ name: 'job_queued_at', type: 'timestamp', nullable: true })
  jobQueuedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => MeetingEntity, (meeting) => meeting.transcriptionUploads, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;
}
