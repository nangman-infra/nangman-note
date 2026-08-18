import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = process.env;

describe('env config', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses same-origin defaults when public endpoints are omitted', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
    };
    delete process.env.NEXT_PUBLIC_API_URL;

    const { env } = await import('./env');

    expect(env.MODE).toBe('development');
    // 빈 문자열 = same-origin (Next.js rewrite 프록시)
    expect(env.API_URL).toBe('');
  });

  it('uses explicit endpoint values when provided', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'http://custom-backend:9999',
    };

    const { env } = await import('./env');

    expect(env.MODE).toBe('development');
    expect(env.API_URL).toBe('http://custom-backend:9999');
  });

  it('has correct default app config values', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
    };

    const { env } = await import('./env');

    expect(env.APP_NAME).toBe('TransNote');
    expect(env.AUTO_SAVE_DELAY).toBe(3000);
  });
});