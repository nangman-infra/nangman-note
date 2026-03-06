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
    expect(env.DB_MIGRATIONS_RUN).toBe(true);
    expect(env.DB_SSL_REJECT_UNAUTHORIZED).toBe(true);
    expect(env.DB_POOL_MAX).toBe(10);
    expect(env.DB_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(env.DB_IDLE_TIMEOUT_MS).toBe(30000);
    expect(env.DB_STATEMENT_TIMEOUT_MS).toBe(15000);
    expect(env.AUTH_ENABLED).toBe(true);
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

  it('defaults bedrock temperature to 0 when not provided', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.AWS_BEDROCK_TEMPERATURE).toBe(0.2);
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
});
