import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('defaults DB_ENGINE to sqljs in development', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.DB_ENGINE).toBe('sqljs');
    expect(env.DB_MIGRATIONS_RUN).toBe(false);
    expect(env.DB_POOL_MAX).toBe(0);
    expect(env.AUTH_ENABLED).toBe(false);
  });

  it('defaults DB_ENGINE to postgres in production', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      PORT: '9999',
      ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DB_HOST: 'db.example.local',
      DB_PORT: '5432',
      DB_NAME: 'nangman_note',
      DB_USER: 'app_user',
      DB_PASSWORD: 'secure-password',
      DB_SSL: 'true',
      AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
      AUTH_OIDC_AUDIENCE: 'transnote-api',
    });

    expect(env.DB_ENGINE).toBe('postgres');
    expect(env.DB_MIGRATIONS_RUN).toBe(false);
    expect(env.DB_SSL_REJECT_UNAUTHORIZED).toBe(true);
    expect(env.DB_POOL_MAX).toBe(10);
    expect(env.DB_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(env.DB_IDLE_TIMEOUT_MS).toBe(30000);
    expect(env.DB_STATEMENT_TIMEOUT_MS).toBe(15000);
    expect(env.AUTH_ENABLED).toBe(true);
  });

  it('allows explicit production migration auto-run when configured', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      PORT: '9999',
      ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DB_HOST: 'db.example.local',
      DB_PORT: '5432',
      DB_NAME: 'nangman_note',
      DB_USER: 'app_user',
      DB_PASSWORD: 'secure-password',
      DB_SSL: 'true',
      DB_MIGRATIONS_RUN: 'true',
      AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
      AUTH_OIDC_AUDIENCE: 'transnote-api',
    });

    expect(env.DB_MIGRATIONS_RUN).toBe(true);
  });

  it('throws when production auth is explicitly disabled', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '9999',
        ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        DB_HOST: 'db.example.local',
        DB_PORT: '5432',
        DB_NAME: 'nangman_note',
        DB_USER: 'app_user',
        DB_PASSWORD: 'secure-password',
        DB_SSL: 'true',
        AUTH_ENABLED: 'false',
        AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
        AUTH_OIDC_AUDIENCE: 'transnote-api',
      }),
    ).toThrow('Environment variable AUTH_ENABLED must be true in production.');
  });

  it('throws when production CORS origin includes a wildcard', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '9999',
        ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        DB_HOST: 'db.example.local',
        DB_PORT: '5432',
        DB_NAME: 'nangman_note',
        DB_USER: 'app_user',
        DB_PASSWORD: 'secure-password',
        DB_SSL: 'true',
        CORS_ORIGIN: 'https://app.example.com,*',
        AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
        AUTH_OIDC_AUDIENCE: 'transnote-api',
      }),
    ).toThrow(
      'Environment variable CORS_ORIGIN must not include * in production.',
    );
  });

  it('throws when production DB_ENGINE is not postgres', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '9999',
        DB_ENGINE: 'sqljs',
        ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      }),
    ).toThrow('In production, DB_ENGINE must be postgres.');
  });

  it('defaults bedrock temperature to 0.2 when not provided', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.AWS_BEDROCK_TEMPERATURE).toBe(0.2);
  });

  it('defaults max speaker labels to 8 when not provided', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.AWS_TRANSCRIBE_MAX_SPEAKER_LABELS).toBe(8);
  });

  it('parses bedrock temperature within valid range', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
      AWS_BEDROCK_TEMPERATURE: '0.7',
    });

    expect(env.AWS_BEDROCK_TEMPERATURE).toBe(0.7);
  });

  it('throws when bedrock temperature is outside range', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '9999',
        ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
        AWS_BEDROCK_TEMPERATURE: '1.5',
      }),
    ).toThrow(
      'Environment variable AWS_BEDROCK_TEMPERATURE must be a number between 0 and 1.',
    );
  });

  it('throws when bedrock temperature is not numeric', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '9999',
        ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
        AWS_BEDROCK_TEMPERATURE: 'not-a-number',
      }),
    ).toThrow(
      'Environment variable AWS_BEDROCK_TEMPERATURE must be a number between 0 and 1.',
    );
  });

  it('throws when max speaker labels is outside range', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '9999',
        ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
        AWS_TRANSCRIBE_MAX_SPEAKER_LABELS: '12',
      }),
    ).toThrow(
      'Environment variable AWS_TRANSCRIBE_MAX_SPEAKER_LABELS must be an integer between 2 and 10.',
    );
  });

  it('throws for placeholder encryption key in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '9999',
        DB_HOST: 'db.example.local',
        DB_PORT: '5432',
        DB_NAME: 'nangman_note',
        DB_USER: 'app_user',
        DB_PASSWORD: 'secure-password',
        DB_SSL: 'true',
        ENCRYPTION_KEY: 'replace-with-64-char-hex-key',
        AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
        AUTH_OIDC_AUDIENCE: 'transnote-api',
      }),
    ).toThrow(
      'Environment variable ENCRYPTION_KEY must be a secure 64-character hex value in production.',
    );
  });

  it('throws when AUTH_OIDC_ISSUER is missing while auth is enabled', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '9999',
        DB_HOST: 'db.example.local',
        DB_PORT: '5432',
        DB_NAME: 'nangman_note',
        DB_USER: 'app_user',
        DB_PASSWORD: 'secure-password',
        DB_SSL: 'true',
        ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        AUTH_OIDC_AUDIENCE: 'transnote-api',
      }),
    ).toThrow('Environment variable AUTH_OIDC_ISSUER is required.');
  });

  it('defaults PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS to null when omitted', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS).toBeNull();
  });

  it('parses PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS within range', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
      PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS: '4',
    });

    expect(env.PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS).toBe(4);
  });

  it('throws when PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS is outside range', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '9999',
        ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
        PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS: '12',
      }),
    ).toThrow(
      'Environment variable PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS must be an integer between 1 and 8.',
    );
  });

  it('parses a versioned encryption keyring and active key ID', () => {
    const oldKey = 'a'.repeat(64);
    const currentKey = 'b'.repeat(64);
    const env = validateEnv({
      NODE_ENV: 'development',
      ENCRYPTION_KEYS: JSON.stringify({ old: oldKey, current: currentKey }),
      ENCRYPTION_ACTIVE_KID: 'current',
    });

    expect(env.ENCRYPTION_KEYS).toEqual({ old: oldKey, current: currentKey });
    expect(env.ENCRYPTION_ACTIVE_KID).toBe('current');
    expect(env.ENCRYPTION_KEY).toBe('');
  });

  it('rejects an encryption active key ID that is missing from the keyring', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        ENCRYPTION_KEYS: JSON.stringify({ old: 'a'.repeat(64) }),
        ENCRYPTION_ACTIVE_KID: 'current',
      }),
    ).toThrow(/references unknown key ID: current/u);
  });

  it('accepts one DB CA source and rejects ambiguous inline/path CA config', () => {
    const base = {
      NODE_ENV: 'development',
      DB_ENGINE: 'postgres',
      DB_HOST: 'db.example.local',
      DB_NAME: 'nangman_note',
      DB_USER: 'app_user',
      DB_PASSWORD: 'password',
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'true',
    };

    expect(validateEnv({ ...base, DB_SSL_CA: 'pem' }).DB_SSL_CA).toBe('pem');
    expect(() =>
      validateEnv({
        ...base,
        DB_SSL_CA: 'pem',
        DB_SSL_CA_PATH: '/run/secrets/rds-ca.pem',
      }),
    ).toThrow(/only one of DB_SSL_CA or DB_SSL_CA_PATH/u);
  });

  it('rejects unverified TLS for production postgres and IAM auth', () => {
    const production = {
      NODE_ENV: 'production',
      ENCRYPTION_KEY: 'a'.repeat(64),
      DB_HOST: 'db.example.local',
      DB_NAME: 'nangman_note',
      DB_USER: 'app_user',
      DB_PASSWORD: 'password',
      AUTH_OIDC_ISSUER: 'https://auth.example.com/application/o/transnote/',
      AUTH_OIDC_AUDIENCE: 'transnote-api',
    };

    expect(() =>
      validateEnv({
        ...production,
        DB_SSL: 'true',
        DB_SSL_REJECT_UNAUTHORIZED: 'false',
      }),
    ).toThrow(/Production PostgreSQL requires/u);
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DB_ENGINE: 'postgres',
        DB_HOST: 'db.example.local',
        DB_NAME: 'nangman_note',
        DB_USER: 'iam_user',
        DB_IAM_AUTH: 'true',
        DB_SSL_REJECT_UNAUTHORIZED: 'false',
      }),
    ).toThrow(/must be true when DB_IAM_AUTH is enabled/u);
  });

  describe('AUTH_OIDC_ALGORITHMS', () => {
    const base = {
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    };

    it('defaults to RS256', () => {
      expect(validateEnv(base).AUTH_OIDC_ALGORITHMS).toEqual(['RS256']);
    });

    it('parses a comma-separated list and dedupes', () => {
      expect(
        validateEnv({ ...base, AUTH_OIDC_ALGORITHMS: 'RS256, ES256,RS256' })
          .AUTH_OIDC_ALGORITHMS,
      ).toEqual(['RS256', 'ES256']);
    });

    it('rejects symmetric or unknown algorithms', () => {
      expect(() =>
        validateEnv({ ...base, AUTH_OIDC_ALGORITHMS: 'HS256' }),
      ).toThrow(/unsupported value\(s\): HS256/);
      expect(() =>
        validateEnv({ ...base, AUTH_OIDC_ALGORITHMS: 'none' }),
      ).toThrow(/unsupported value\(s\): none/);
    });
  });

  describe('TRUST_PROXY', () => {
    const base = {
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    };

    it('defaults to loopback', () => {
      expect(validateEnv(base).TRUST_PROXY).toBe('loopback');
    });

    it('accepts booleans, hop counts and address lists', () => {
      expect(validateEnv({ ...base, TRUST_PROXY: 'FALSE' }).TRUST_PROXY).toBe(
        'false',
      );
      expect(validateEnv({ ...base, TRUST_PROXY: '2' }).TRUST_PROXY).toBe('2');
      expect(
        validateEnv({ ...base, TRUST_PROXY: '10.0.0.0/8, 127.0.0.1' })
          .TRUST_PROXY,
      ).toBe('10.0.0.0/8, 127.0.0.1');
    });

    it('rejects garbage', () => {
      expect(() => validateEnv({ ...base, TRUST_PROXY: 'yes please' })).toThrow(
        /TRUST_PROXY/,
      );
    });
  });
});
