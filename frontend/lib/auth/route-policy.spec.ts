import { describe, expect, it } from 'vitest';
import {
  buildCallbackUrl,
  isAuthPath,
  isBackendProxyPath,
  isHealthPath,
  isNextAuthPath,
  isProtectedPath,
} from './route-policy';

describe('route-policy', () => {
  it('protects the home, meeting and settings routes', () => {
    expect(isProtectedPath('/')).toBe(true);
    expect(isProtectedPath('/meeting')).toBe(true);
    expect(isProtectedPath('/meeting/new')).toBe(true);
    expect(isProtectedPath('/settings/profile')).toBe(true);
  });

  it('does not protect public or look-alike routes', () => {
    expect(isProtectedPath('/landing')).toBe(false);
    expect(isProtectedPath('/legal/privacy')).toBe(false);
    expect(isProtectedPath('/meetings')).toBe(false);
    expect(isProtectedPath('/auth/signin')).toBe(false);
  });

  it('classifies auth, backend, next-auth and health paths', () => {
    expect(isAuthPath('/auth/signin')).toBe(true);
    expect(isAuthPath('/authentication')).toBe(false);

    expect(isBackendProxyPath('/api/v1/meetings')).toBe(true);
    expect(isBackendProxyPath('/ws/meeting-status')).toBe(true);
    expect(isBackendProxyPath('/apis')).toBe(false);

    expect(isNextAuthPath('/api/auth/session')).toBe(true);
    expect(isNextAuthPath('/api/authz')).toBe(false);

    expect(isHealthPath('/api/health')).toBe(true);
    expect(isHealthPath('/api/healthz')).toBe(false);
  });

  it('builds a callbackUrl that never points back at an auth page', () => {
    expect(buildCallbackUrl('/meeting/1', '?tab=notes', '#top')).toBe(
      '/meeting/1?tab=notes#top',
    );
    expect(buildCallbackUrl('/auth/signin', '?callbackUrl=%2F')).toBe('/');
    expect(buildCallbackUrl('')).toBe('/');
  });
});
