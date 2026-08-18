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

  /** Transcribe Speaker Diarization 라벨 (e.g. 'spk_0') */
  @Column({
    name: 'speaker_label',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  speakerLabel?: string;

  /**
   * 이 세그먼트를 생성한 배치 전사 잡 ID (실시간 세그먼트는 null).
   * 재수집 시 해당 잡의 세그먼트만 교체하여 멱등성을 보장하고,
   * 실시간→배치 폴백 시 실시간 세그먼트를 보존하기 위해 사용합니다.
   */
  @Column({ name: 'transcription_job_id', type: 'uuid', nullable: true })
  transcriptionJobId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => MeetingEntity, (meeting) => meeting.transcripts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;
}
