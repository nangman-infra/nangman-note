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
import { MeetingStatus } from './meeting-status.enum';
import { MeetingTranscriptionMode } from './meeting-transcription-mode.enum';

@Entity('meeting')
export class MeetingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string;

  @Column({ name: 'prompt_id', type: 'varchar', length: 120 })
  promptId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: MeetingStatus.RECORDING,
  })
  status: MeetingStatus;

  @Column({
    name: 'transcription_mode',
    type: 'varchar',
    length: 20,
    default: MeetingTranscriptionMode.BATCH,
  })
  transcriptionMode: MeetingTranscriptionMode;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
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
