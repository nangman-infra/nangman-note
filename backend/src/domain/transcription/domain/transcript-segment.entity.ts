import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';

@Entity('transcript_segment')
export class TranscriptSegmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id', type: 'uuid' })
  meetingId: string;

  @Column({ name: 'start_time', type: 'float' })
  startTime: number;

  @Column({ name: 'end_time', type: 'float' })
  endTime: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'float', default: 0.9 })
  confidence: number;

  /** 번역된 텍스트 (null이면 번역 안 함) */
  @Column({ name: 'translated_text', type: 'text', nullable: true })
  translatedText?: string;

  /** Transcribe가 감지한 언어 코드 (e.g. 'ko-KR') */
  @Column({
    name: 'detected_language',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  detectedLanguage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => MeetingEntity, (meeting) => meeting.transcripts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;
}
