export interface AppEnv {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  DB_ENGINE: 'sqljs' | 'postgres';
  DB_MIGRATIONS_RUN: boolean;
  DB_PATH: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_IDLE_TIMEOUT_MS: number;
  DB_STATEMENT_TIMEOUT_MS: number;
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
  AWS_BEDROCK_TEMPERATURE: number;
  REALTIME_MAX_CONCURRENT_SESSIONS: number;
  REALTIME_MAX_BUFFERED_AUDIO_BYTES: number;
  REALTIME_MAX_AUDIO_CHUNK_BYTES: number;
  REALTIME_BACKPRESSURE_RETRY_MS: number;
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

function readFloatInRange(
  config: Record<string, unknown>,
  key: string,
  options: {
    fallback: number;
    min: number;
    max: number;
  },
): number {
  const rawValue = config[key];
  const value =
    typeof rawValue === 'string' && rawValue.trim().length > 0
      ? Number(rawValue)
      : options.fallback;

  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= options.min &&
    value <= options.max
  ) {
    return value;
  }

  throw new Error(
    `Environment variable ${key} must be a number between ${options.min} and ${options.max}.`,
  );
}

function readBoolean(
  config: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const rawValue = config[key];
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Environment variable ${key} must be true or false.`);
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
  const defaultDbEngine = typedNodeEnv === 'production' ? 'postgres' : 'sqljs';
  const dbEngineRaw = readString(config, 'DB_ENGINE', defaultDbEngine);
  if (!['sqljs', 'postgres'].includes(dbEngineRaw)) {
    throw new Error(
      'Environment variable DB_ENGINE must be one of sqljs, postgres.',
    );
  }
  const dbEngine = dbEngineRaw as AppEnv['DB_ENGINE'];

  if (typedNodeEnv === 'production' && dbEngine !== 'postgres') {
    throw new Error('In production, DB_ENGINE must be postgres.');
  }

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
  const dbMigrationsRun = readBoolean(
    config,
    'DB_MIGRATIONS_RUN',
    dbEngine === 'postgres',
  );
  const postgresDefaults =
    typedNodeEnv === 'production'
      ? {
          hostFallback: undefined,
          nameFallback: undefined,
          userFallback: undefined,
          passwordFallback: undefined,
        }
      : {
          hostFallback: 'localhost',
          nameFallback: 'nangman_note',
          userFallback: 'postgres',
          passwordFallback: 'postgres',
        };

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
    DB_ENGINE: dbEngine,
    DB_MIGRATIONS_RUN: dbMigrationsRun,
    DB_PATH: readString(config, 'DB_PATH', defaultDbPath),
    DB_HOST:
      dbEngine === 'postgres'
        ? readString(config, 'DB_HOST', postgresDefaults.hostFallback)
        : '',
    DB_PORT: dbEngine === 'postgres' ? readNumber(config, 'DB_PORT', 5432) : 0,
    DB_NAME:
      dbEngine === 'postgres'
        ? readString(config, 'DB_NAME', postgresDefaults.nameFallback)
        : '',
    DB_USER:
      dbEngine === 'postgres'
        ? readString(config, 'DB_USER', postgresDefaults.userFallback)
        : '',
    DB_PASSWORD:
      dbEngine === 'postgres'
        ? readString(config, 'DB_PASSWORD', postgresDefaults.passwordFallback)
        : '',
    DB_SSL:
      dbEngine === 'postgres'
        ? readBoolean(config, 'DB_SSL', typedNodeEnv === 'production')
        : false,
    DB_SSL_REJECT_UNAUTHORIZED:
      dbEngine === 'postgres'
        ? readBoolean(
            config,
            'DB_SSL_REJECT_UNAUTHORIZED',
            typedNodeEnv === 'production',
          )
        : false,
    DB_POOL_MAX:
      dbEngine === 'postgres' ? readNumber(config, 'DB_POOL_MAX', 10) : 0,
    DB_CONNECTION_TIMEOUT_MS:
      dbEngine === 'postgres'
        ? readNumber(config, 'DB_CONNECTION_TIMEOUT_MS', 5000)
        : 0,
    DB_IDLE_TIMEOUT_MS:
      dbEngine === 'postgres'
        ? readNumber(config, 'DB_IDLE_TIMEOUT_MS', 30000)
        : 0,
    DB_STATEMENT_TIMEOUT_MS:
      dbEngine === 'postgres'
        ? readNumber(config, 'DB_STATEMENT_TIMEOUT_MS', 15000)
        : 0,
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
    AWS_BEDROCK_TEMPERATURE: readFloatInRange(
      config,
      'AWS_BEDROCK_TEMPERATURE',
      {
        fallback: 0,
        min: 0,
        max: 1,
      },
    ),
    REALTIME_MAX_CONCURRENT_SESSIONS: readNumber(
      config,
      'REALTIME_MAX_CONCURRENT_SESSIONS',
      8,
    ),
    REALTIME_MAX_BUFFERED_AUDIO_BYTES: readNumber(
      config,
      'REALTIME_MAX_BUFFERED_AUDIO_BYTES',
      4 * 1024 * 1024,
    ),
    REALTIME_MAX_AUDIO_CHUNK_BYTES: readNumber(
      config,
      'REALTIME_MAX_AUDIO_CHUNK_BYTES',
      64 * 1024,
    ),
    REALTIME_BACKPRESSURE_RETRY_MS: readNumber(
      config,
      'REALTIME_BACKPRESSURE_RETRY_MS',
      200,
    ),
    LOG_LEVEL: readString(config, 'LOG_LEVEL', 'info'),
    CORS_ORIGIN: readString(
      config,
      'CORS_ORIGIN',
      'http://localhost:3000,http://127.0.0.1:3000',
    ),
  };
}
