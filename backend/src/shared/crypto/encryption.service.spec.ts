import { ConfigService } from '@nestjs/config';
import { createCipheriv, randomBytes } from 'crypto';
import type { AppEnv } from '../config/env.validation';
import {
  EncryptionDecryptionError,
  EncryptionService,
} from './encryption.service';

const OLD_KEY = 'a'.repeat(64);
const CURRENT_KEY = 'b'.repeat(64);

function createService(options?: {
  keys?: Record<string, string>;
  activeKid?: string;
  legacyKey?: string;
}): EncryptionService {
  const values = {
    ENCRYPTION_KEYS: options?.keys ?? { current: CURRENT_KEY },
    ENCRYPTION_ACTIVE_KID: options?.activeKid ?? 'current',
    ENCRYPTION_KEY: options?.legacyKey ?? '',
  };
  const configService = {
    get: jest.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<AppEnv, true>;
  return new EncryptionService(configService);
}

function createLegacyCiphertext(plaintext: string, rawKey: string): string {
  const key = Buffer.from(rawKey, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function expectDecryptionFailure(
  action: () => unknown,
  reason: EncryptionDecryptionError['reason'],
): void {
  try {
    action();
    throw new Error('Expected decryption to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EncryptionDecryptionError);
    expect(error).toMatchObject({ reason });
  }
}

describe('EncryptionService', () => {
  it('writes a versioned envelope with the active key ID and decrypts it', () => {
    const service = createService();
    const plaintext = '안녕하세요. 테스트 데이터입니다.';

    const encrypted = service.encrypt(plaintext, 'NoteEntity.content');

    expect(encrypted).toMatch(/^enc:v1:current:/u);
    expect(encrypted).not.toContain(plaintext);
    expect(service.isEncrypted(encrypted)).toBe(true);
    expect(service.decrypt(encrypted, 'NoteEntity.content')).toBe(plaintext);
  });

  it('returns empty strings and ordinary plaintext as-is', () => {
    const service = createService();

    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
    expect(service.decrypt('이것은 평문:입니다')).toBe('이것은 평문:입니다');
    expect(service.isEncrypted('이것은 평문:입니다')).toBe(false);
  });

  it('produces different ciphertext for the same plaintext', () => {
    const service = createService();
    const first = service.encrypt('동일한 평문');
    const second = service.encrypt('동일한 평문');

    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe('동일한 평문');
    expect(service.decrypt(second)).toBe('동일한 평문');
  });

  it('decrypts envelopes from an old key after rotating the active key', () => {
    const oldService = createService({
      keys: { old: OLD_KEY },
      activeKid: 'old',
    });
    const encrypted = oldService.encrypt('회전 전 데이터');
    const rotatedService = createService({
      keys: { old: OLD_KEY, current: CURRENT_KEY },
      activeKid: 'current',
    });

    expect(rotatedService.decrypt(encrypted)).toBe('회전 전 데이터');
    expect(rotatedService.encrypt('새 데이터')).toMatch(/^enc:v1:current:/u);
  });

  it('binds versioned ciphertext to its entity field and meeting row AAD', () => {
    const service = createService();
    const encrypted = service.encrypt(
      '노트',
      'NoteEntity.content|meetingId=meeting-1',
    );

    expectDecryptionFailure(
      () =>
        service.decrypt(encrypted, 'ResultEntity.content|meetingId=meeting-1'),
      'AUTHENTICATION_FAILED',
    );
    expectDecryptionFailure(
      () =>
        service.decrypt(encrypted, 'NoteEntity.content|meetingId=meeting-2'),
      'AUTHENTICATION_FAILED',
    );
  });

  it('throws a typed controlled error for tampered or malformed ciphertext', () => {
    const service = createService();
    const encrypted = service.encrypt('민감한 데이터');
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('0') ? '1' : '0'}`;

    expectDecryptionFailure(
      () => service.decrypt(tampered),
      'AUTHENTICATION_FAILED',
    );
    expectDecryptionFailure(
      () => service.decrypt('enc:v1:broken'),
      'MALFORMED_ENVELOPE',
    );
  });

  it('fails closed when a versioned envelope references an unavailable key', () => {
    const service = createService();
    const encrypted = service
      .encrypt('민감한 데이터')
      .replace(':current:', ':retired:');

    expectDecryptionFailure(() => service.decrypt(encrypted), 'UNKNOWN_KEY');
  });

  it('decrypts legacy iv:tag:ciphertext envelopes during migration', () => {
    const legacyCiphertext = createLegacyCiphertext('기존 데이터', OLD_KEY);
    const service = createService({
      keys: { current: CURRENT_KEY, old: OLD_KEY },
      activeKid: 'current',
    });

    expect(service.isEncrypted(legacyCiphertext)).toBe(true);
    expect(service.decrypt(legacyCiphertext, 'ignored-for-legacy')).toBe(
      '기존 데이터',
    );
  });

  it('does not return malformed legacy-looking ciphertext as plaintext', () => {
    const service = createService();
    const malformed = `${'a'.repeat(32)}:bad-tag:00`;
    const malformedIv = `${'z'.repeat(32)}:${'a'.repeat(32)}:00`;

    expect(service.isEncrypted(malformed)).toBe(true);
    expectDecryptionFailure(
      () => service.decrypt(malformed),
      'MALFORMED_ENVELOPE',
    );
    expect(service.isEncrypted(malformedIv)).toBe(true);
    expectDecryptionFailure(
      () => service.decrypt(malformedIv),
      'MALFORMED_ENVELOPE',
    );
  });
});
