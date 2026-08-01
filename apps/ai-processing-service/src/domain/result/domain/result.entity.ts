import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { PromptEntity } from '../../prompt/domain/prompt.entity';

interface ResultMetadata {
  title?: string;
  generatedAt: string;
  totalDuration: number;
  transcriptWordCount: number;
  noteLength: number;
}

@Entity('meeting_result')
export class ResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id', type: 'uuid', unique: true })
  meetingId: string;

  @Column({ name: 'prompt_id', type: 'varchar', length: 120 })
  promptId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json' })
  metadata: ResultMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => MeetingEntity, (meeting) => meeting.result, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;

  @ManyToOne(() => PromptEntity, (prompt) => prompt.results, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'prompt_id' })
  prompt: PromptEntity;
}
