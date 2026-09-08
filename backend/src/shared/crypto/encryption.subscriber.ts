import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import {
  EncryptionDecryptionError,
  EncryptionService,
} from './encryption.service';
import { TranscriptSegmentEntity } from '../../domain/transcription/domain/transcript-segment.entity';
import { NoteEntity } from '../../domain/note/domain/note.entity';
import { ResultEntity } from '../../domain/result/domain/result.entity';
import { MeetingSearchDocumentEntity } from '../../domain/meeting/domain/meeting-search-document.entity';
import { StructuredLogger } from '../logging/structured-logger';

type EncryptableEntity =
  | TranscriptSegmentEntity
  | NoteEntity
  | ResultEntity
  | MeetingSearchDocumentEntity;

interface EncryptionFieldMap {
  entityClass: new (...args: unknown[]) => EncryptableEntity;
  fields: Record<string, string>;
}

const ENCRYPTION_TARGETS: EncryptionFieldMap[] = [
  {
    entityClass: TranscriptSegmentEntity,
    fields: {
      text: 'TranscriptSegmentEntity.text',
      translatedText: 'TranscriptSegmentEntity.translatedText',
    },
  },
  {
    entityClass: NoteEntity,
    fields: { content: 'NoteEntity.content' },
  },
  {
    entityClass: ResultEntity,
    fields: { content: 'ResultEntity.content' },
  },
  {
    entityClass: MeetingSearchDocumentEntity,
    fields: {
      noteContent: 'MeetingSearchDocumentEntity.noteContent',
      resultContent: 'MeetingSearchDocumentEntity.resultContent',
      transcriptContent: 'MeetingSearchDocumentEntity.transcriptContent',
    },
  },
];

@Injectable()
@EventSubscriber()
export class EncryptionSubscriber implements EntitySubscriberInterface {
  private readonly logger = new StructuredLogger(EncryptionSubscriber.name);

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly encryptionService: EncryptionService,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<EncryptableEntity>): void {
    this.encryptFields(event.entity);
  }

  afterInsert(event: InsertEvent<EncryptableEntity>): void {
    this.decryptFields(event.entity);
  }

  beforeUpdate(event: UpdateEvent<EncryptableEntity>): void {
    if (event.entity) {
      this.encryptFields(event.entity as EncryptableEntity);
    }
  }

  afterUpdate(event: UpdateEvent<EncryptableEntity>): void {
    if (event.entity) {
      this.decryptFields(event.entity as EncryptableEntity);
    }
  }

  afterLoad(entity: EncryptableEntity): void {
    this.decryptFields(entity);
  }

  private encryptFields(entity: EncryptableEntity): void {
    if (!entity) return;

    for (const target of ENCRYPTION_TARGETS) {
      if (entity instanceof target.entityClass) {
        for (const [field, aad] of Object.entries(target.fields)) {
          const value = (entity as unknown as Record<string, unknown>)[field];
          if (
            typeof value === 'string' &&
            value.length > 0 &&
            !this.encryptionService.isEncrypted(value)
          ) {
            (entity as unknown as Record<string, unknown>)[field] =
              this.encryptionService.encrypt(value, this.buildAad(entity, aad));
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
        for (const [field, aad] of Object.entries(target.fields)) {
          const record = entity as unknown as Record<string, unknown>;
          const value = record[field];
          if (
            typeof value !== 'string' ||
            !this.encryptionService.isEncrypted(value)
          ) {
            continue;
          }

          try {
            record[field] = this.encryptionService.decrypt(
              value,
              this.buildAad(entity, aad),
            );
          } catch (error) {
            if (
              entity instanceof MeetingSearchDocumentEntity &&
              error instanceof EncryptionDecryptionError
            ) {
              // A single corrupt derived projection field must not abort hydration
              // of every search row. Exclude only that field from matching.
              record[field] = '';
              this.logger.warn('encryption.search_projection.corrupt_field', {
                meetingId: entity.meetingId,
                field,
                reason: error.reason,
              });
              continue;
            }
            throw error;
          }
        }
        break;
      }
    }
  }

  private buildAad(entity: EncryptableEntity, fieldAad: string): string {
    const meetingId = entity.meetingId;
    if (typeof meetingId !== 'string' || !meetingId) {
      throw new Error(
        `Cannot encrypt or decrypt ${fieldAad} without a meeting ID.`,
      );
    }
    return `${fieldAad}|meetingId=${meetingId}`;
  }
}
