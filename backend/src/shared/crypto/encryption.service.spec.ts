import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    const configService = {
      get: jest
        .fn()
        .mockReturnValue('dev-only-encryption-key-replace-in-production'),
    } as unknown as ConfigService;

    service = new EncryptionService(configService);
  });

  it('encrypts and decrypts text correctly', () => {
    const plaintext = '안녕하세요. 테스트 데이터입니다.';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(service.isEncrypted(encrypted)).toBe(true);

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('returns empty string as-is', () => {
    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
  });

  it('returns plaintext if not encrypted format', () => {
    const plaintext = '이것은 평문입니다';
    expect(service.decrypt(plaintext)).toBe(plaintext);
    expect(service.isEncrypted(plaintext)).toBe(false);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const plaintext = '동일한 평문';
    const enc1 = service.encrypt(plaintext);
    const enc2 = service.encrypt(plaintext);

    expect(enc1).not.toBe(enc2);
    expect(service.decrypt(enc1)).toBe(plaintext);
    expect(service.decrypt(enc2)).toBe(plaintext);
  });

  it('works with hex key', () => {
    const hexKey = 'a'.repeat(64);
    const configService = {
      get: jest.fn().mockReturnValue(hexKey),
    } as unknown as ConfigService;

    const hexService = new EncryptionService(configService);
    const plaintext = '테스트';
    const encrypted = hexService.encrypt(plaintext);
    expect(hexService.decrypt(encrypted)).toBe(plaintext);
  });
});
