import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type ColumnType,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { TranscriptionJobProvider } from './transcription-job-provider.enum';
import { TranscriptionJobStatus } from './transcription-job-status.enum';

const nullableDateColumnType: ColumnType =
  process.env.DB_ENGINE === 'postgres' || process.env.NODE_ENV === 'production'
    ? 'timestamp'
    : 'datetime';

@Entity('transcription_job')
export class TranscriptionJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id', type: 'uuid' })
  meetingId: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: TranscriptionJobProvider.AWS_TRANSCRIBE,
  })
  provider: TranscriptionJobProvider;

  @Column({ name: 'provider_job_id', type: 'varchar', length: 255 })
  providerJobId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TranscriptionJobStatus.QUEUED,
  })
  status: TranscriptionJobStatus;

  @Column({ name: 'media_uri', type: 'varchar', length: 2048 })
  mediaUri: string;

  @Column({
    name: 'language_code',
    type: 'varchar',
    length: 32,
    default: 'ko-KR',
  })
  languageCode: string;

  @Column({
    name: 'transcript_uri',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  transcriptUri?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({
    name: 'collected_at',
    type: nullableDateColumnType,
    nullable: true,
  })
  collectedAt?: Date | null;

  /**
   * 이 잡의 오디오가 회의 시작 기준 몇 초 지점부터 녹음됐는지 (멀티 세션 녹음 지원).
   * 수집 시 세그먼트 타임스탬프에 이 값을 더해 회의 타임라인으로 정렬합니다.
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

  @ManyToOne(() => MeetingEntity, (meeting) => meeting.transcriptionJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;
}
