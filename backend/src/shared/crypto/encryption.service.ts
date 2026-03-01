import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AppEnv } from '../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const rawKey = this.configService.get('ENCRYPTION_KEY', { infer: true });
    // 키가 64자 hex이면 그대로, 아니면 SHA-256으로 32바이트 키 파생
    this.key = /^[a-f0-9]{64}$/i.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : createHash('sha256').update(rawKey).digest();
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // 형식: iv:authTag:ciphertext
    return [iv.toString('hex'), authTag, encrypted].join(SEPARATOR);
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.includes(SEPARATOR)) return ciphertext;

    const parts = ciphertext.split(SEPARATOR);
    if (parts.length !== 3) return ciphertext; // 암호화되지 않은 평문

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      return ciphertext; // 형식 불일치 → 평문 반환 (마이그레이션 호환)
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /** 값이 암호화된 형식인지 확인 */
  isEncrypted(value: string): boolean {
    if (!value || !value.includes(SEPARATOR)) return false;
    const parts = value.split(SEPARATOR);
    return parts.length === 3 && /^[a-f0-9]{32}$/i.test(parts[0]);
  }
}
