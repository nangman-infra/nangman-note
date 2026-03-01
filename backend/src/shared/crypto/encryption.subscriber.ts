import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  LoadEvent,
  DataSource,
} from 'typeorm';
import { EncryptionService } from './encryption.service';
import { TranscriptSegmentEntity } from '../../domain/transcription/domain/transcript-segment.entity';
import { NoteEntity } from '../../domain/note/domain/note.entity';
import { ResultEntity } from '../../domain/result/domain/result.entity';

type EncryptableEntity = TranscriptSegmentEntity | NoteEntity | ResultEntity;

interface EncryptionFieldMap {
  entityClass: new (...args: unknown[]) => EncryptableEntity;
  fields: string[];
}

const ENCRYPTION_TARGETS: EncryptionFieldMap[] = [
  { entityClass: TranscriptSegmentEntity, fields: ['text', 'translatedText'] },
  { entityClass: NoteEntity, fields: ['content'] },
  { entityClass: ResultEntity, fields: ['content'] },
];

@Injectable()
@EventSubscriber()
export class EncryptionSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly encryptionService: EncryptionService,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<EncryptableEntity>): void {
    this.encryptFields(event.entity);
  }

  beforeUpdate(event: UpdateEvent<EncryptableEntity>): void {
    if (event.entity) {
      this.encryptFields(event.entity as EncryptableEntity);
    }
  }

  afterLoad(entity: EncryptableEntity, _event?: LoadEvent<EncryptableEntity>): void {
    this.decryptFields(entity);
  }

  private encryptFields(entity: EncryptableEntity): void {
    if (!entity) return;

    for (const target of ENCRYPTION_TARGETS) {
      if (entity instanceof target.entityClass) {
        for (const field of target.fields) {
          const value = (entity as unknown as Record<string, unknown>)[field];
          if (typeof value === 'string' && value.length > 0 && !this.encryptionService.isEncrypted(value)) {
            (entity as unknown as Record<string, unknown>)[field] = this.encryptionService.encrypt(value);
          }
        }
        break;
      }
    }
  }

  private decryptFields(entity: EncryptableEntity): void {
    if (!entity) return;

    for (const target of ENCRYPTION_TARGETS) {
      if (entity instanceof target.entityClass) {
        for (const field of target.fields) {
          const value = (entity as unknown as Record<string, unknown>)[field];
          if (typeof value === 'string' && this.encryptionService.isEncrypted(value)) {
            (entity as unknown as Record<string, unknown>)[field] = this.encryptionService.decrypt(value);
          }
        }
        break;
      }
    }
  }
}
