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

@Entity('prompt')
export class PromptEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  content: string;

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
