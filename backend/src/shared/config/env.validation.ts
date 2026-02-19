export interface AppEnv {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  DB_PATH: string;
  ENCRYPTION_KEY: string;
  AWS_REGION: string;
  AWS_PROFILE: string;
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
    LOG_LEVEL: readString(config, 'LOG_LEVEL', 'info'),
    CORS_ORIGIN: readString(
      config,
      'CORS_ORIGIN',
      'http://localhost:3000,http://127.0.0.1:3000',
    ),
  };
}
