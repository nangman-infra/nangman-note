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
  DB_IAM_AUTH: boolean;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  DB_SSL_CA: string;
  DB_SSL_CA_PATH: string;
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_IDLE_TIMEOUT_MS: number;
  DB_STATEMENT_TIMEOUT_MS: number;
  /** Legacy ciphertext fallback key. New deployments should use ENCRYPTION_KEYS. */
  ENCRYPTION_KEY: string;
  ENCRYPTION_KEYS: Record<string, string>;
  ENCRYPTION_ACTIVE_KID: string;
  AWS_REGION: string;
  AWS_PROFILE: string;
  AWS_TRANSCRIBE_JOB_PREFIX: string;
  AWS_TRANSCRIBE_LANGUAGE_CODE: string;
  AWS_TRANSCRIBE_OUTPUT_BUCKET: string;
  AWS_TRANSCRIBE_MEDIA_FORMAT: string;
  AWS_TRANSCRIBE_MAX_SPEAKER_LABELS: number;
  AWS_TRANSCRIBE_VOCABULARY_NAME: string;
  AWS_S3_AUDIO_BUCKET: string;
  AWS_S3_AUDIO_KEY_PREFIX: string;
  AWS_BEDROCK_MODEL_ID: string;
  AWS_BEDROCK_MAX_TOKENS: number;
  AWS_BEDROCK_TEMPERATURE: number;
  REALTIME_MAX_CONCURRENT_SESSIONS: number;
  REALTIME_MAX_BUFFERED_AUDIO_BYTES: number;
  REALTIME_MAX_AUDIO_CHUNK_BYTES: number;
  REALTIME_BACKPRESSURE_RETRY_MS: number;
  AUTH_ENABLED: boolean;
  AUTH_OIDC_ISSUER: string;
  AUTH_OIDC_AUDIENCE: string;
  AUTH_OIDC_JWKS_URI: string;
  /** 허용하는 JWS 서명 알고리즘 목록 (비대칭 키만). 기본 RS256 */
  AUTH_OIDC_ALGORITHMS: string[];
  /**
   * Express `trust proxy` 설정 값. 리버스 프록시(NPM/Next.js) 뒤에서 X-Forwarded-For 로
   * 실제 클라이언트 IP 를 복원하기 위해 필요. 'false' 면 비활성.
   */
  TRUST_PROXY: string;
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: string;
  PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS: number | null;
  PLAYWRIGHT_PDF_RENDER_TIMEOUT_MS: number;
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

function readOptionalString(
  config: Record<string, unknown>,
  key: string,
): string {
  const rawValue = config[key];
  return typeof rawValue === 'string' ? rawValue.trim() : '';
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

function readIntegerInRange(
  config: Record<string, unknown>,
  key: string,
  options: {
    fallback: number;
    min: number;
    max: number;
  },
): number {
  const value = readNumber(config, key, options.fallback);

  if (value >= options.min && value <= options.max) {
    return value;
  }

  throw new Error(
    `Environment variable ${key} must be an integer between ${options.min} and ${options.max}.`,
  );
}

function readOptionalIntegerInRange(
  config: Record<string, unknown>,
  key: string,
  options: {
    min: number;
    max: number;
  },
): number | null {
  const rawValue = config[key];

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return null;
  }

  const value = Number(rawValue);

  if (Number.isInteger(value) && value >= options.min && value <= options.max) {
    return value;
  }

  throw new Error(
    `Environment variable ${key} must be an integer between ${options.min} and ${options.max}.`,
  );
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

function readEncryptionKeys(
  config: Record<string, unknown>,
): Record<string, string> {
  const raw = readOptionalString(config, 'ENCRYPTION_KEYS');
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'Environment variable ENCRYPTION_KEYS must be a JSON object of key IDs to key values.',
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'Environment variable ENCRYPTION_KEYS must be a JSON object of key IDs to key values.',
    );
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    throw new Error(
      'Environment variable ENCRYPTION_KEYS must contain at least one key.',
    );
  }

  const validatedEntries = entries.map(([kid, value]) => {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(kid)) {
      throw new Error(
        `Environment variable ENCRYPTION_KEYS contains invalid key ID: ${kid}.`,
      );
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `Environment variable ENCRYPTION_KEYS key ${kid} must be a non-empty string.`,
      );
    }
    return [kid, value.trim()] as const;
  });

  return Object.fromEntries(validatedEntries);
}

/**
 * JWKS(공개키)로 검증 가능한 비대칭 JWS 알고리즘만 허용한다.
 * HS*(대칭)와 none 은 원격 JWKS 검증 모델에서 의미가 없고 알고리즘 혼동 공격 표면이 된다.
 */
const ALLOWED_OIDC_ALGORITHMS = new Set([
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
]);

function readOidcAlgorithms(config: Record<string, unknown>): string[] {
  const raw = readString(config, 'AUTH_OIDC_ALGORITHMS', 'RS256');
  const algorithms = Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (algorithms.length === 0) {
    throw new Error(
      'Environment variable AUTH_OIDC_ALGORITHMS must list at least one algorithm.',
    );
  }

  const invalid = algorithms.filter((alg) => !ALLOWED_OIDC_ALGORITHMS.has(alg));
  if (invalid.length > 0) {
    throw new Error(
      `Environment variable AUTH_OIDC_ALGORITHMS contains unsupported value(s): ${invalid.join(
        ', ',
      )}. Allowed: ${Array.from(ALLOWED_OIDC_ALGORITHMS).join(', ')}.`,
    );
  }

  return algorithms;
}

/**
 * Express `trust proxy` 값. 기본은 loopback — 같은 호스트의 리버스 프록시(NPM, Next.js proxy)만 신뢰.
 * 허용: false | true | loopback | linklocal | uniquelocal | IP/CIDR 목록(콤마) | 홉 수(정수)
 */
function readTrustProxy(config: Record<string, unknown>): string {
  const raw = readString(config, 'TRUST_PROXY', 'loopback');
  const normalized = raw.toLowerCase();

  if (
    ['true', 'false', 'loopback', 'linklocal', 'uniquelocal'].includes(
      normalized,
    )
  ) {
    return normalized;
  }
  if (/^\d+$/.test(raw)) {
    return raw;
  }
  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const looksLikeAddressList =
    entries.length > 0 &&
    entries.every(
      (entry) =>
        /^[0-9a-f.:]+(\/\d{1,3})?$/i.test(entry) ||
        ['loopback', 'linklocal', 'uniquelocal'].includes(entry.toLowerCase()),
    );
  if (looksLikeAddressList) {
    return entries.join(', ');
  }

  throw new Error(
    'Environment variable TRUST_PROXY must be true, false, loopback, linklocal, uniquelocal, a hop count, or a comma-separated IP/CIDR list.',
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
  const configuredEncryptionKeys = readEncryptionKeys(config);
  const configuredActiveKid = readOptionalString(
    config,
    'ENCRYPTION_ACTIVE_KID',
  );
  const hasConfiguredKeyring = Object.keys(configuredEncryptionKeys).length > 0;
  const encryptionKey =
    readOptionalString(config, 'ENCRYPTION_KEY') ||
    (hasConfiguredKeyring
      ? ''
      : 'dev-only-encryption-key-replace-in-production');
  let encryptionKeys: Record<string, string>;
  let encryptionActiveKid: string;

  if (hasConfiguredKeyring) {
    if (!configuredActiveKid) {
      throw new Error(
        'Environment variable ENCRYPTION_ACTIVE_KID is required when ENCRYPTION_KEYS is configured.',
      );
    }
    if (!configuredEncryptionKeys[configuredActiveKid]) {
      throw new Error(
        `Environment variable ENCRYPTION_ACTIVE_KID references unknown key ID: ${configuredActiveKid}.`,
      );
    }
    encryptionKeys = configuredEncryptionKeys;
    encryptionActiveKid = configuredActiveKid;
  } else {
    if (configuredActiveKid && configuredActiveKid !== 'legacy') {
      throw new Error(
        'Environment variable ENCRYPTION_ACTIVE_KID requires ENCRYPTION_KEYS.',
      );
    }
    encryptionKeys = { legacy: encryptionKey };
    encryptionActiveKid = 'legacy';
  }

  const defaultDbPath =
    typedNodeEnv === 'test'
      ? ':memory:'
      : typedNodeEnv === 'production'
        ? './data/prod.db'
        : './data/dev.db';
  const dbMigrationsRun = readBoolean(config, 'DB_MIGRATIONS_RUN', false);
  const authEnabled = readBoolean(
    config,
    'AUTH_ENABLED',
    typedNodeEnv === 'production',
  );
  const dbIamAuth =
    dbEngine === 'postgres' ? readBoolean(config, 'DB_IAM_AUTH', false) : false;
  const dbSsl =
    dbEngine === 'postgres'
      ? readBoolean(config, 'DB_SSL', typedNodeEnv === 'production')
      : false;
  const dbSslRejectUnauthorized =
    dbEngine === 'postgres'
      ? readBoolean(
          config,
          'DB_SSL_REJECT_UNAUTHORIZED',
          typedNodeEnv === 'production',
        )
      : false;
  const dbSslCa =
    dbEngine === 'postgres' ? readOptionalString(config, 'DB_SSL_CA') : '';
  const dbSslCaPath =
    dbEngine === 'postgres' ? readOptionalString(config, 'DB_SSL_CA_PATH') : '';

  if (dbSslCa && dbSslCaPath) {
    throw new Error(
      'Configure only one of DB_SSL_CA or DB_SSL_CA_PATH, not both.',
    );
  }
  if (dbIamAuth && !dbSslRejectUnauthorized) {
    throw new Error(
      'DB_SSL_REJECT_UNAUTHORIZED must be true when DB_IAM_AUTH is enabled.',
    );
  }
  if (
    typedNodeEnv === 'production' &&
    dbEngine === 'postgres' &&
    (!dbSsl || !dbSslRejectUnauthorized)
  ) {
    throw new Error(
      'Production PostgreSQL requires DB_SSL=true and DB_SSL_REJECT_UNAUTHORIZED=true.',
    );
  }

  const postgresDefaults =
    typedNodeEnv === 'production'
      ? {
          hostFallback: undefined,
          nameFallback: undefined,
          userFallback: undefined,
          // IAM DB auth 사용 시 비밀번호 불필요
          passwordFallback: dbIamAuth ? '' : undefined,
        }
      : {
          hostFallback: 'localhost',
          nameFallback: 'nangman_note',
          userFallback: 'postgres',
          passwordFallback: 'postgres',
        };

  if (typedNodeEnv === 'production') {
    if (
      !hasConfiguredKeyring &&
      isLikelyPlaceholderEncryptionKey(encryptionKey)
    ) {
      throw new Error(
        'Environment variable ENCRYPTION_KEY must be a secure 64-character hex value in production.',
      );
    }

    const insecureKeyIds = Object.entries(encryptionKeys)
      .filter(([, value]) => isLikelyPlaceholderEncryptionKey(value))
      .map(([kid]) => kid);
    if (insecureKeyIds.length > 0) {
      throw new Error(
        `Environment variable ENCRYPTION_KEYS must contain secure 64-character hex values in production (invalid: ${insecureKeyIds.join(', ')}).`,
      );
    }
    if (encryptionKey && isLikelyPlaceholderEncryptionKey(encryptionKey)) {
      throw new Error(
        'Environment variable ENCRYPTION_KEY legacy fallback must be a secure 64-character hex value in production.',
      );
    }
  }

  if (typedNodeEnv === 'production' && !authEnabled) {
    throw new Error(
      'Environment variable AUTH_ENABLED must be true in production.',
    );
  }

  const corsOrigin = readString(
    config,
    'CORS_ORIGIN',
    'http://localhost:3000,http://127.0.0.1:3000',
  );
  const corsOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (typedNodeEnv === 'production' && corsOrigins.includes('*')) {
    throw new Error(
      'Environment variable CORS_ORIGIN must not include * in production.',
    );
  }

  const authIssuer = authEnabled
    ? readString(config, 'AUTH_OIDC_ISSUER')
    : readString(config, 'AUTH_OIDC_ISSUER', '');
  const authAudience = authEnabled
    ? readString(config, 'AUTH_OIDC_AUDIENCE')
    : readString(config, 'AUTH_OIDC_AUDIENCE', '');
  const authJwksUri = readString(config, 'AUTH_OIDC_JWKS_URI', '');
  const authAlgorithms = readOidcAlgorithms(config);
  const trustProxy = readTrustProxy(config);

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
    DB_IAM_AUTH: dbIamAuth,
    DB_SSL: dbSsl,
    DB_SSL_REJECT_UNAUTHORIZED: dbSslRejectUnauthorized,
    DB_SSL_CA: dbSslCa,
    DB_SSL_CA_PATH: dbSslCaPath,
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
    ENCRYPTION_KEYS: encryptionKeys,
    ENCRYPTION_ACTIVE_KID: encryptionActiveKid,
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
    AWS_TRANSCRIBE_MAX_SPEAKER_LABELS: readIntegerInRange(
      config,
      'AWS_TRANSCRIBE_MAX_SPEAKER_LABELS',
      {
        fallback: 8,
        min: 2,
        max: 10,
      },
    ),
    AWS_TRANSCRIBE_VOCABULARY_NAME: readString(
      config,
      'AWS_TRANSCRIBE_VOCABULARY_NAME',
      '',
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
        fallback: 0.2,
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
      8 * 1024 * 1024,
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
    AUTH_ENABLED: authEnabled,
    AUTH_OIDC_ISSUER: authIssuer,
    AUTH_OIDC_AUDIENCE: authAudience,
    AUTH_OIDC_JWKS_URI: authJwksUri,
    AUTH_OIDC_ALGORITHMS: authAlgorithms,
    TRUST_PROXY: trustProxy,
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: readString(
      config,
      'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
      '',
    ),
    PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS: readOptionalIntegerInRange(
      config,
      'PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS',
      {
        min: 1,
        max: 8,
      },
    ),
    PLAYWRIGHT_PDF_RENDER_TIMEOUT_MS: readNumber(
      config,
      'PLAYWRIGHT_PDF_RENDER_TIMEOUT_MS',
      60_000,
    ),
    LOG_LEVEL: readString(config, 'LOG_LEVEL', 'info'),
    CORS_ORIGIN: corsOrigin,
  };
}
