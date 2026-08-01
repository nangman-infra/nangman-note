import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MeetingEntity } from './meeting.entity';

@Entity('meeting_search_document')
export class MeetingSearchDocumentEntity {
  @PrimaryColumn('uuid', { name: 'meeting_id' })
  meetingId: string;

  @Column({ name: 'owner_sub', type: 'varchar', length: 255, nullable: true })
  ownerSub?: string;

  @Column({ type: 'text', default: '' })
  title: string;

  @Column({ name: 'note_content', type: 'text', default: '' })
  noteContent: string;

  @Column({ name: 'result_content', type: 'text', default: '' })
  resultContent: string;

  @Column({ name: 'transcript_content', type: 'text', default: '' })
  transcriptContent: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => MeetingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;
}
