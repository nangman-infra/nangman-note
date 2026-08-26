import { DataSource, InsertEvent, UpdateEvent } from 'typeorm';
import { NoteEntity } from '../../domain/note/domain/note.entity';
import { ResultEntity } from '../../domain/result/domain/result.entity';
import { TranscriptSegmentEntity } from '../../domain/transcription/domain/transcript-segment.entity';
import { MeetingSearchDocumentEntity } from '../../domain/meeting/domain/meeting-search-document.entity';
import { EncryptionSubscriber } from './encryption.subscriber';
import type { EncryptionService } from './encryption.service';

type EncryptableEntity =
  | NoteEntity
  | ResultEntity
  | TranscriptSegmentEntity
  | MeetingSearchDocumentEntity;

describe('EncryptionSubscriber', () => {
  let subscriber: EncryptionSubscriber;
  let encryptionService: jest.Mocked<
    Pick<EncryptionService, 'encrypt' | 'decrypt' | 'isEncrypted'>
  >;

  beforeEach(() => {
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) =>
        value.startsWith('enc:') ? value.slice(4) : value,
      ),
      isEncrypted: jest.fn((value: string) => value.startsWith('enc:')),
    };

    const dataSource = {
      subscribers: [],
    } as unknown as DataSource;

    subscriber = new EncryptionSubscriber(
      dataSource,
      encryptionService as unknown as EncryptionService,
    );
  });

  it('encrypts on beforeInsert and decrypts on afterInsert', () => {
    const entity = buildNoteEntity('회의 노트');

    subscriber.beforeInsert({
      entity,
    } as InsertEvent<EncryptableEntity>);
    expect(entity.content).toBe('enc:회의 노트');

    subscriber.afterInsert({
      entity,
    } as InsertEvent<EncryptableEntity>);
    expect(entity.content).toBe('회의 노트');
  });

  it('encrypts on beforeUpdate and decrypts on afterUpdate', () => {
    const entity = buildResultEntity('회의록 본문');

    subscriber.beforeUpdate({
      entity,
    } as unknown as UpdateEvent<EncryptableEntity>);
    expect(entity.content).toBe('enc:회의록 본문');

    subscriber.afterUpdate({
      entity,
    } as unknown as UpdateEvent<EncryptableEntity>);
    expect(entity.content).toBe('회의록 본문');
  });

  it('decrypts loaded encrypted transcript fields', () => {
    const entity = buildTranscriptEntity('enc:원문', 'enc:번역본');

    subscriber.afterLoad(entity);

    expect(entity.text).toBe('원문');
    expect(entity.translatedText).toBe('번역본');
  });

  it('encrypts sensitive search projection fields before persistence', () => {
    const entity = new MeetingSearchDocumentEntity();
    entity.title = '공개 제목';
    entity.noteContent = '민감한 노트';
    entity.resultContent = '민감한 결과';
    entity.transcriptContent = '민감한 전사';

    subscriber.beforeInsert({ entity } as InsertEvent<EncryptableEntity>);

    expect(entity).toEqual(
      expect.objectContaining({
        title: '공개 제목',
        noteContent: 'enc:민감한 노트',
        resultContent: 'enc:민감한 결과',
        transcriptContent: 'enc:민감한 전사',
      }),
    );
    expect(JSON.stringify(entity)).not.toContain('"noteContent":"민감한 노트"');
    expect(JSON.stringify(entity)).not.toContain(
      '"resultContent":"민감한 결과"',
    );
    expect(JSON.stringify(entity)).not.toContain(
      '"transcriptContent":"민감한 전사"',
    );
  });
});

function buildNoteEntity(content: string): NoteEntity {
  const entity = new NoteEntity();
  entity.content = content;
  return entity;
}

function buildResultEntity(content: string): ResultEntity {
  const entity = new ResultEntity();
  entity.content = content;
  return entity;
}

function buildTranscriptEntity(
  text: string,
  translatedText?: string,
): TranscriptSegmentEntity {
  const entity = new TranscriptSegmentEntity();
  entity.text = text;
  entity.translatedText = translatedText;
  return entity;
}
