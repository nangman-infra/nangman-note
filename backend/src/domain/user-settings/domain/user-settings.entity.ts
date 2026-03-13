import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';

@Entity('user_settings')
export class UserSettingsEntity {
  @PrimaryColumn({ name: 'owner_sub', type: 'varchar', length: 255 })
  ownerSub: string;

  @Column({
    name: 'default_prompt_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  defaultPromptId?: string | null;

  @Column({
    name: 'default_transcription_mode',
    type: 'varchar',
    length: 20,
    default: MeetingTranscriptionMode.REALTIME,
  })
  defaultTranscriptionMode: MeetingTranscriptionMode;

  @Column({
    name: 'default_language_code',
    type: 'varchar',
    length: 20,
    default: '',
  })
  defaultLanguageCode: string;

  @Column({
    name: 'default_translate_target_language',
    type: 'varchar',
    length: 10,
    default: '',
  })
  defaultTranslateTargetLanguage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
