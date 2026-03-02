import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeEnv } from './runtime-env';

describe('runtime-env', () => {
  beforeEach(() => {
    // window 초기화
    delete (window as unknown as Record<string, unknown>).__RUNTIME_ENV__;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__RUNTIME_ENV__;
  });

  it('returns empty string when __RUNTIME_ENV__ is not set', () => {
    expect(getRuntimeEnv('WS_URL')).toBe('');
  });

  it('returns WS_URL from __RUNTIME_ENV__', () => {
    window.__RUNTIME_ENV__ = { WS_URL: 'https://app.example.com' };
    expect(getRuntimeEnv('WS_URL')).toBe('https://app.example.com');
  });

  it('returns empty string when WS_URL is empty', () => {
    window.__RUNTIME_ENV__ = { WS_URL: '' };
    expect(getRuntimeEnv('WS_URL')).toBe('');
  });
});