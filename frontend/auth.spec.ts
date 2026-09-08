import type { Account, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_REFRESH_BUFFER_MS,
  __resetAuthCachesForTests,
  createAuthOptions,
  getAuthOptions,
  shouldRefreshAccessToken,
} from './auth';

const ISSUER = 'https://auth.example.com/application/o/transnote/';
const TOKEN_ENDPOINT = 'https://auth.example.com/application/o/token/';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function discoveryResponse(): Response {
  return jsonResponse({ token_endpoint: TOKEN_ENDPOINT });
}

async function runJwt(token: JWT, account: Account | null = null): Promise<JWT> {
  const options = createAuthOptions();
  const jwt = options.callbacks?.jwt;
  if (!jwt) throw new Error('jwt callback missing');
  return jwt({
    token,
    account,
    user: { id: 'user-1' },
  } as Parameters<typeof jwt>[0]);
}

describe('auth.ts', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    process.env.AUTHENTIK_ISSUER = ISSUER;
    process.env.AUTHENTIK_CLIENT_ID = 'client-id';
    process.env.AUTHENTIK_CLIENT_SECRET = 'client-secret';
    __resetAuthCachesForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('shouldRefreshAccessToken', () => {
    it('refreshes when the token or expiry is missing', () => {
      expect(shouldRefreshAccessToken({})).toBe(true);
      expect(shouldRefreshAccessToken({ accessToken: 'a' })).toBe(true);
    });

    it('refreshes inside the buffer window and not before', () => {
      const now = 1_000_000;
      const expiresAt = now + ACCESS_TOKEN_REFRESH_BUFFER_MS + 1;
      expect(shouldRefreshAccessToken({ accessToken: 'a', accessTokenExpires: expiresAt }, now)).toBe(false);
      expect(shouldRefreshAccessToken({ accessToken: 'a', accessTokenExpires: now + 1000 }, now)).toBe(true);
    });
  });

  describe('jwt callback', () => {
    it('stores tokens from the initial sign-in account', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 300;
      const result = await runJwt({}, {
        provider: 'authentik',
        type: 'oauth',
        providerAccountId: 'sub',
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_at: expiresAt,
      });

      expect(result.accessToken).toBe('access-1');
      expect(result.refreshToken).toBe('refresh-1');
      expect(result.accessTokenExpires).toBe(expiresAt * 1000);
      expect(result.error).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the token untouched while it is still fresh', async () => {
      const token: JWT = {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() + 10 * 60 * 1000,
      };

      await expect(runJwt(token)).resolves.toBe(token);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes an expiring token and rotates the refresh token', async () => {
      fetchMock
        .mockResolvedValueOnce(discoveryResponse())
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 300 }),
        );

      const result = await runJwt({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() + 1000,
      });

      expect(result.accessToken).toBe('access-2');
      expect(result.refreshToken).toBe('refresh-2');
      expect(result.error).toBeUndefined();
      expect(result.accessTokenExpires).toBeGreaterThan(Date.now() + 290_000);

      const [, tokenRequest] = fetchMock.mock.calls[1] ?? [];
      const body = (tokenRequest as RequestInit).body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('refresh-1');
      expect(body.get('client_id')).toBe('client-id');
    });

    it('invalidates the session on a permanent refresh failure (invalid_grant)', async () => {
      fetchMock
        .mockResolvedValueOnce(discoveryResponse())
        .mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));

      const result = await runJwt({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() - 1000,
        name: 'User',
      });

      expect(result.error).toBe('RefreshAccessTokenError');
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.accessTokenExpires).toBeUndefined();
      expect(result.name).toBe('User');
    });

    it('invalidates the session when there is no refresh token to use', async () => {
      const result = await runJwt({
        accessToken: 'access-1',
        accessTokenExpires: Date.now() - 1000,
      });

      expect(result.error).toBe('RefreshAccessTokenError');
      expect(result.accessToken).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps existing tokens on a transient IdP failure (5xx)', async () => {
      fetchMock
        .mockResolvedValueOnce(discoveryResponse())
        .mockResolvedValueOnce(jsonResponse({ error: 'server_error' }, 503));

      const result = await runJwt({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() + 1000,
      });

      expect(result.accessToken).toBe('access-1');
      expect(result.refreshToken).toBe('refresh-1');
      expect(result.error).toBeUndefined();
    });

    it('keeps existing tokens when the token endpoint is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await runJwt({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() + 1000,
      });

      expect(result.accessToken).toBe('access-1');
      expect(result.refreshToken).toBe('refresh-1');
      expect(result.error).toBeUndefined();
    });

    it('dedupes concurrent refreshes for the same refresh token', async () => {
      let resolveToken: (value: Response) => void = () => {};
      fetchMock
        .mockResolvedValueOnce(discoveryResponse())
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            resolveToken = resolve;
          }),
        );

      const token: JWT = {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() - 1,
      };
      const first = runJwt({ ...token });
      const second = runJwt({ ...token });
      await Promise.resolve();

      resolveToken(
        jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 300 }),
      );
      const [a, b] = await Promise.all([first, second]);

      expect(a.accessToken).toBe('access-2');
      expect(b.accessToken).toBe('access-2');
      // discovery 1회 + token 1회
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('serves an already-rotated result to a late request carrying the old refresh token', async () => {
      fetchMock
        .mockResolvedValueOnce(discoveryResponse())
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 300 }),
        );

      const stale: JWT = {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpires: Date.now() - 1,
      };
      const first = await runJwt({ ...stale });
      expect(first.refreshToken).toBe('refresh-2');

      // 첫 refresh 가 끝난 뒤, 아직 옛 쿠키를 들고 온 요청
      const late = await runJwt({ ...stale });

      expect(late.accessToken).toBe('access-2');
      expect(late.refreshToken).toBe('refresh-2');
      expect(late.error).toBeUndefined();
      // IdP 에 폐기된 refresh token 을 다시 보내지 않았다
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('session callback', () => {
    it('exposes access token, expiry and error to the client', async () => {
      const options = createAuthOptions();
      const sessionCallback = options.callbacks?.session;
      if (!sessionCallback) throw new Error('session callback missing');

      const result = (await sessionCallback({
        session: { user: { name: 'User' }, expires: '2099-01-01T00:00:00.000Z' },
        token: {
          accessToken: 'access-1',
          accessTokenExpires: 123,
          error: 'RefreshAccessTokenError',
        },
        user: { id: 'user-1' },
        newSession: undefined,
        trigger: 'update',
      } as unknown as Parameters<typeof sessionCallback>[0])) as Session;

      expect(result.accessToken).toBe('access-1');
      expect(result.accessTokenExpires).toBe(123);
      expect(result.error).toBe('RefreshAccessTokenError');
    });
  });

  describe('getAuthOptions', () => {
    it('pins secure OAuth cookies to the canonical HTTPS origin', () => {
      expect(getAuthOptions().useSecureCookies).toBe(true);
    });

    it('reuses the same options object across calls', () => {
      expect(getAuthOptions()).toBe(getAuthOptions());
    });

    it('rebuilds options when the canonical auth origin changes', () => {
      const before = getAuthOptions();
      process.env.NEXTAUTH_URL = 'http://localhost:3000';

      const after = getAuthOptions();

      expect(after).not.toBe(before);
      expect(after.useSecureCookies).toBe(false);
    });

    it('rebuilds options when the runtime secret changes', () => {
      const before = getAuthOptions();
      process.env.AUTHENTIK_CLIENT_SECRET = 'rotated-secret';

      const after = getAuthOptions();

      expect(after).not.toBe(before);
      expect(after).toBe(getAuthOptions());
    });

    it('fails loudly when a required env var is missing', () => {
      process.env.AUTHENTIK_CLIENT_SECRET = '';
      expect(() => getAuthOptions()).toThrow(/AUTHENTIK_CLIENT_SECRET/);
    });
  });
});
