import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = process.env;

describe('env config', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses development defaults when public endpoints are omitted', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
    };
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;

    const { env } = await import('./env');

    expect(env.MODE).toBe('development');
    expect(env.API_URL).toBe('http://localhost:9999');
    expect(env.WS_URL).toBe('ws://localhost:9999');
  });

  it('uses production defaults and warns when explicit endpoints are missing', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
    };
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = await import('./env');

    expect(env.MODE).toBe('production');
    expect(env.API_URL).toBe('https://api.example.com');
    expect(env.WS_URL).toBe('wss://api.example.com');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Production mode is using fallback endpoints. Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL explicitly.',
    );
  });

  it('throws when URL schema is invalid', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'not-a-url',
    };

    await expect(import('./env')).rejects.toThrow(
      'Invalid frontend environment variables',
    );
  });
});
