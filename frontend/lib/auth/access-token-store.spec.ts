import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_EXPIRY_SKEW_MS,
  clearAccessToken,
  getAccessToken,
  onReauthenticationRequested,
  requestReauthentication,
  setAccessToken,
} from './access-token-store';

describe('access-token-store', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it('returns the stored token when no expiry is known', () => {
    setAccessToken('token-a');
    expect(getAccessToken()).toBe('token-a');
  });

  it('clears the token when set to undefined', () => {
    setAccessToken('token-a');
    setAccessToken(undefined);
    expect(getAccessToken()).toBeUndefined();
  });

  it('treats a token that expires within the skew window as absent', () => {
    const now = 1_000_000;
    setAccessToken('token-a', now + ACCESS_TOKEN_EXPIRY_SKEW_MS - 1);

    expect(getAccessToken(now)).toBeUndefined();
    // 폐기된 토큰은 이후 호출에서도 다시 나타나지 않는다
    expect(getAccessToken(0)).toBeUndefined();
  });

  it('returns a token that is comfortably before expiry', () => {
    const now = 1_000_000;
    setAccessToken('token-a', now + ACCESS_TOKEN_EXPIRY_SKEW_MS + 1);

    expect(getAccessToken(now)).toBe('token-a');
  });

  it('notifies reauthentication listeners and supports unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = onReauthenticationRequested(listener);

    requestReauthentication('session-missing');
    expect(listener).toHaveBeenCalledWith('session-missing');

    unsubscribe();
    requestReauthentication('session-error');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates listener failures from the caller', () => {
    const failing = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    const unsubscribeFailing = onReauthenticationRequested(failing);
    const unsubscribeHealthy = onReauthenticationRequested(healthy);

    expect(() => requestReauthentication('session-missing')).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);

    unsubscribeFailing();
    unsubscribeHealthy();
  });
});
