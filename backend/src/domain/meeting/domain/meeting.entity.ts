import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { ResultEntity } from '../../result/domain/result.entity';
import { TranscriptionJobEntity } from '../../transcription/domain/transcription-job.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { MeetingProcessingPhase } from './meeting-processing-phase.enum';
import { MeetingStatus } from './meeting-status.enum';
import { MeetingTranscriptionMode } from './meeting-transcription-mode.enum';

@Entity('meeting')
export class MeetingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_sub', type: 'varchar', length: 255, nullable: true })
  ownerSub?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  agenda?: string;

  @Column({ name: 'prompt_id', type: 'varchar', length: 120 })
  promptId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: MeetingStatus.RECORDING,
  })
  status: MeetingStatus;

  @Column({
    name: 'processing_phase',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  processingPhase?: MeetingProcessingPhase | null;

  @Column({
    name: 'needs_attention',
    type: 'boolean',
    default: false,
  })
  needsAttention: boolean;

  @Column({
    name: 'transcription_mode',
    type: 'varchar',
    length: 20,
    default: MeetingTranscriptionMode.BATCH,
  })
  transcriptionMode: MeetingTranscriptionMode;

  /** 전사 언어 코드 (e.g. 'ko-KR', 'en-US'). null이면 자동 감지 */
  @Column({
    name: 'language_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  languageCode?: string;

  /** 번역 대상 언어 (e.g. 'ko', 'en'). null이면 번역 안 함 */
  @Column({
    name: 'translate_target_language',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  translateTargetLanguage?: string;

  @Column({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  @ManyToOne(() => PromptEntity, (prompt) => prompt.meetings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'prompt_id' })
  prompt: PromptEntity;

  @OneToOne(() => NoteEntity, (note) => note.meeting)
  note?: NoteEntity;

  @OneToOne(() => ResultEntity, (result) => result.meeting)
  result?: ResultEntity;

  @OneToMany(() => TranscriptSegmentEntity, (segment) => segment.meeting)
  transcripts?: TranscriptSegmentEntity[];

  @OneToMany(() => TranscriptionJobEntity, (job) => job.meeting)
  transcriptionJobs?: TranscriptionJobEntity[];
}
