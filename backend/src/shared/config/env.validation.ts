export interface AppEnv {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  DB_PATH: string;
  ENCRYPTION_KEY: string;
  AWS_REGION: string;
  AWS_PROFILE: string;
  AWS_TRANSCRIBE_JOB_PREFIX: string;
  AWS_TRANSCRIBE_LANGUAGE_CODE: string;
  AWS_TRANSCRIBE_OUTPUT_BUCKET: string;
  AWS_TRANSCRIBE_MEDIA_FORMAT: string;
  AWS_S3_AUDIO_BUCKET: string;
  AWS_S3_AUDIO_KEY_PREFIX: string;
  AWS_BEDROCK_MODEL_ID: string;
  AWS_BEDROCK_MAX_TOKENS: number;
  AWS_BEDROCK_TEMPERATURE: string;
  LOG_LEVEL: string;
  CORS_ORIGIN: string;
}

function readString(
  config: Record<string, unknown>,
  key: string,
  fallback?: string,
): string {
  const rawValue = config[key];

  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    return rawValue.trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Environment variable ${key} is required.`);
}

function readNumber(
  config: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const rawValue = config[key];
  const value =
    typeof rawValue === 'string' && rawValue.trim().length > 0
      ? Number(rawValue)
      : fallback;

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  throw new Error(`Environment variable ${key} must be a positive integer.`);
}

function isLikelyPlaceholderEncryptionKey(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith('dev-only-') ||
    normalized.includes('replace') ||
    normalized.includes('your-64-character') ||
    !/^[a-f0-9]{64}$/i.test(value)
  );
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = readString(config, 'NODE_ENV', 'development');

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(
      'Environment variable NODE_ENV must be one of development, test, production.',
    );
  }
  const typedNodeEnv = nodeEnv as AppEnv['NODE_ENV'];

  const port = readNumber(config, 'PORT', 9999);
  const encryptionKey = readString(
    config,
    'ENCRYPTION_KEY',
    'dev-only-encryption-key-replace-in-production',
  );
  const defaultDbPath =
    typedNodeEnv === 'test'
      ? ':memory:'
      : typedNodeEnv === 'production'
        ? './data/prod.db'
        : './data/dev.db';

  if (
    typedNodeEnv === 'production' &&
    isLikelyPlaceholderEncryptionKey(encryptionKey)
  ) {
    throw new Error(
      'Environment variable ENCRYPTION_KEY must be a secure 64-character hex value in production.',
    );
  }

  return {
    PORT: port,
    NODE_ENV: typedNodeEnv,
    DB_PATH: readString(config, 'DB_PATH', defaultDbPath),
    ENCRYPTION_KEY: encryptionKey,
    AWS_REGION: readString(config, 'AWS_REGION', 'ap-northeast-2'),
    AWS_PROFILE: readString(config, 'AWS_PROFILE', 'default'),
    AWS_TRANSCRIBE_JOB_PREFIX: readString(
      config,
      'AWS_TRANSCRIBE_JOB_PREFIX',
      'nangman-note',
    ),
    AWS_TRANSCRIBE_LANGUAGE_CODE: readString(
      config,
      'AWS_TRANSCRIBE_LANGUAGE_CODE',
      'ko-KR',
    ),
    AWS_TRANSCRIBE_OUTPUT_BUCKET: readString(
      config,
      'AWS_TRANSCRIBE_OUTPUT_BUCKET',
      '',
    ),
    AWS_TRANSCRIBE_MEDIA_FORMAT: readString(
      config,
      'AWS_TRANSCRIBE_MEDIA_FORMAT',
      'webm',
    ),
    AWS_S3_AUDIO_BUCKET: readString(config, 'AWS_S3_AUDIO_BUCKET', ''),
    AWS_S3_AUDIO_KEY_PREFIX: readString(
      config,
      'AWS_S3_AUDIO_KEY_PREFIX',
      'meeting-audio',
    ),
    AWS_BEDROCK_MODEL_ID: readString(
      config,
      'AWS_BEDROCK_MODEL_ID',
      'amazon.nova-pro-v1:0',
    ),
    AWS_BEDROCK_MAX_TOKENS: readNumber(config, 'AWS_BEDROCK_MAX_TOKENS', 4096),
    AWS_BEDROCK_TEMPERATURE: readString(
      config,
      'AWS_BEDROCK_TEMPERATURE',
      '0.3',
    ),
    LOG_LEVEL: readString(config, 'LOG_LEVEL', 'info'),
    CORS_ORIGIN: readString(
      config,
      'CORS_ORIGIN',
      'http://localhost:3000,http://127.0.0.1:3000',
    ),
  };
}
