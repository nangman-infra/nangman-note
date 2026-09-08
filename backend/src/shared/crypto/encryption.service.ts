import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { AppEnv } from '../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const VERSIONED_PREFIX = 'enc';
const ENVELOPE_VERSION = 'v1';
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';
const DEFAULT_AAD = 'nangman-note.default';
const VERSIONED_PART_COUNT = 6;

type DecryptionFailureReason =
  | 'MALFORMED_ENVELOPE'
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_KEY'
  | 'AUTHENTICATION_FAILED';

/**
 * 암호문 손상/키 불일치를 평문으로 오인하지 않도록 호출자에게 전달하는 통제된 오류.
 * 메시지에는 원문 암호문이나 키 값을 절대 포함하지 않는다.
 */
export class EncryptionDecryptionError extends Error {
  constructor(public readonly reason: DecryptionFailureReason) {
    super(`Encrypted value could not be decrypted (${reason}).`);
    this.name = 'EncryptionDecryptionError';
  }
}

@Injectable()
export class EncryptionService {
  private readonly keys = new Map<string, Buffer>();
  private readonly activeKid: string;
  private readonly legacyKeys: Buffer[];

  constructor(configService: ConfigService<AppEnv, true>) {
    const configuredKeys = configService.get('ENCRYPTION_KEYS', {
      infer: true,
    });
    this.activeKid = configService.get('ENCRYPTION_ACTIVE_KID', {
      infer: true,
    });
    const legacyRawKey = configService.get('ENCRYPTION_KEY', { infer: true });

    for (const [kid, rawKey] of Object.entries(configuredKeys)) {
      this.keys.set(kid, this.deriveKey(rawKey));
    }
    if (!this.keys.has(this.activeKid)) {
      throw new Error(
        `Active encryption key ID is not present in the configured keyring: ${this.activeKid}`,
      );
    }

    const legacyCandidates = [
      ...(legacyRawKey ? [this.deriveKey(legacyRawKey)] : []),
      ...this.keys.values(),
    ];
    this.legacyKeys = legacyCandidates.filter(
      (candidate, index, all) =>
        all.findIndex((other) => candidate.equals(other)) === index,
    );
  }

  encrypt(plaintext: string, aad = DEFAULT_AAD): string {
    if (!plaintext) return plaintext;

    const key = this.keys.get(this.activeKid);
    if (!key) {
      throw new Error('Active encryption key is unavailable.');
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      VERSIONED_PREFIX,
      ENVELOPE_VERSION,
      this.activeKid,
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(SEPARATOR);
  }

  decrypt(ciphertext: string, aad = DEFAULT_AAD): string {
    if (!ciphertext) return ciphertext;

    if (ciphertext.startsWith(`${VERSIONED_PREFIX}${SEPARATOR}`)) {
      return this.decryptVersioned(ciphertext, aad);
    }
    if (!this.looksLikeLegacyEnvelope(ciphertext)) {
      return ciphertext;
    }
    return this.decryptLegacy(ciphertext);
  }

  /** 값이 versioned 또는 legacy 암호문으로 보이는지 확인합니다. */
  isEncrypted(value: string): boolean {
    return (
      !!value &&
      (value.startsWith(`${VERSIONED_PREFIX}${SEPARATOR}`) ||
        this.looksLikeLegacyEnvelope(value))
    );
  }

  private decryptVersioned(ciphertext: string, aad: string): string {
    const parts = ciphertext.split(SEPARATOR);
    if (parts.length !== VERSIONED_PART_COUNT) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }

    const [prefix, version, kid, ivHex, authTagHex, encryptedHex] = parts;
    if (prefix !== VERSIONED_PREFIX) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }
    if (version !== ENVELOPE_VERSION) {
      throw new EncryptionDecryptionError('UNSUPPORTED_VERSION');
    }
    if (!kid || !this.isValidHex(ivHex) || !this.isValidHex(authTagHex)) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }
    if (!this.isValidHex(encryptedHex, false)) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }

    const key = this.keys.get(kid);
    if (!key) {
      throw new EncryptionDecryptionError('UNKNOWN_KEY');
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new EncryptionDecryptionError('AUTHENTICATION_FAILED');
    }
  }

  private decryptLegacy(ciphertext: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(SEPARATOR);
    if (
      !this.isValidHex(ivHex) ||
      !this.isValidHex(authTagHex) ||
      !this.isValidHex(encryptedHex, false)
    ) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (iv.length !== LEGACY_IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new EncryptionDecryptionError('MALFORMED_ENVELOPE');
    }

    for (const key of this.legacyKeys) {
      try {
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([
          decipher.update(Buffer.from(encryptedHex, 'hex')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        // Legacy envelopes have no key ID. Try each configured rotation key.
      }
    }
    throw new EncryptionDecryptionError('AUTHENTICATION_FAILED');
  }

  private looksLikeLegacyEnvelope(value: string): boolean {
    const parts = value.split(SEPARATOR);
    return (
      parts.length === 3 &&
      (parts[0].length === LEGACY_IV_LENGTH * 2 ||
        parts[1].length === AUTH_TAG_LENGTH * 2)
    );
  }

  private isValidHex(value: string, allowEmpty = true): boolean {
    return (
      (allowEmpty || value.length > 0) &&
      value.length % 2 === 0 &&
      /^[a-f0-9]*$/i.test(value)
    );
  }

  private deriveKey(rawKey: string): Buffer {
    return /^[a-f0-9]{64}$/i.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : createHash('sha256').update(rawKey).digest();
  }
}
