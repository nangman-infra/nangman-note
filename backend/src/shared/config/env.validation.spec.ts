import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('defaults bedrock temperature to 0 when not provided', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '9999',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    });

    expect(env.AWS_BEDROCK_TEMPERATURE).toBe(0);
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
        ENCRYPTION_KEY: 'replace-with-64-char-hex-key',
      }),
    ).toThrow(
      'Environment variable ENCRYPTION_KEY must be a secure 64-character hex value in production.',
    );
  });
});
