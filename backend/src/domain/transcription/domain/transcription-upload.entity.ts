import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type ColumnType,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { TranscriptionUploadStatus } from './transcription-upload-status.enum';

// sqljs(개발/테스트)는 'timestamp' 타입을 지원하지 않으므로 엔진별로 분기
// (transcription-job.entity.ts의 collected_at과 동일한 패턴)
const nullableDateColumnType: ColumnType =
  process.env.DB_ENGINE === 'postgres' || process.env.NODE_ENV === 'production'
    ? 'timestamp'
    : 'datetime';

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

  @Column({
    name: 'confirmed_at',
    type: nullableDateColumnType,
    nullable: true,
  })
  confirmedAt?: Date | null;

  @Column({
    name: 'job_queued_at',
    type: nullableDateColumnType,
    nullable: true,
  })
  jobQueuedAt?: Date | null;

  /**
   * 이 업로드 파일이 회의 시작 기준 몇 초 지점부터 녹음됐는지 (멀티 세션 녹음 지원).
   * null이면 단일 세션 녹음(오프셋 0) 또는 레거시 업로드.
   */
  @Column({
    name: 'start_offset_seconds',
    type: 'float',
    nullable: true,
  })
  startOffsetSeconds?: number | null;

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
