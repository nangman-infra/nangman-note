import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/react', () => ({
  getSession: getSessionMock,
}));

import { clearAccessToken, getAccessToken, setAccessToken } from './access-token-store';
import { fetchSessionAccessToken, resolveAccessToken } from './session-token';

describe('session-token', () => {
  beforeEach(() => {
    clearAccessToken();
    getSessionMock.mockReset();
  });

  it('stores and returns the access token from a healthy session', async () => {
    getSessionMock.mockResolvedValue({
      accessToken: 'token-a',
      accessTokenExpires: Date.now() + 60_000,
    });

    await expect(fetchSessionAccessToken()).resolves.toBe('token-a');
    expect(getAccessToken()).toBe('token-a');
  });

  it('returns undefined and clears the store when there is no session', async () => {
    setAccessToken('stale');
    getSessionMock.mockResolvedValue(null);

    await expect(fetchSessionAccessToken()).resolves.toBeUndefined();
    expect(getAccessToken()).toBeUndefined();
  });

  it('treats a session in error state as unusable', async () => {
    getSessionMock.mockResolvedValue({
      accessToken: 'stale',
      error: 'RefreshAccessTokenError',
    });

    await expect(fetchSessionAccessToken()).resolves.toBeUndefined();
    expect(getAccessToken()).toBeUndefined();
  });

  it('swallows getSession failures as "no token"', async () => {
    getSessionMock.mockRejectedValue(new Error('network'));

    await expect(fetchSessionAccessToken()).resolves.toBeUndefined();
  });

  it('dedupes concurrent session fetches into a single request', async () => {
    let resolveSession: (value: unknown) => void = () => {};
    getSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    const first = fetchSessionAccessToken();
    const second = fetchSessionAccessToken();
    const third = resolveAccessToken();
    expect(getSessionMock).toHaveBeenCalledTimes(1);

    resolveSession({ accessToken: 'token-a' });
    await expect(Promise.all([first, second, third])).resolves.toEqual([
      'token-a',
      'token-a',
      'token-a',
    ]);

    // 완료 후에는 새 요청이 다시 나간다
    getSessionMock.mockResolvedValue({ accessToken: 'token-b' });
    clearAccessToken();
    await expect(fetchSessionAccessToken()).resolves.toBe('token-b');
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it('resolveAccessToken prefers the in-memory token', async () => {
    setAccessToken('cached');

    await expect(resolveAccessToken()).resolves.toBe('cached');
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
