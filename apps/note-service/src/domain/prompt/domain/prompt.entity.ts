import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { ResultEntity } from '../../result/domain/result.entity';
import { PromptDocumentType } from './prompt-document-type.enum';

@Entity('prompt')
export class PromptEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ name: 'owner_sub', type: 'varchar', length: 255, nullable: true })
  ownerSub?: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 20,
    default: PromptDocumentType.MEETING,
  })
  documentType: PromptDocumentType;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MeetingEntity, (meeting) => meeting.prompt)
  meetings: MeetingEntity[];

  @OneToMany(() => ResultEntity, (result) => result.prompt)
  results: ResultEntity[];
}
