import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import AuthentikProvider from 'next-auth/providers/authentik';
import { getAuthPublicUrl } from '@/lib/auth/auth-origin';
import { getServerRuntimeVar } from '@/lib/config/env';

interface AuthRuntimeConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

interface RefreshedTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

type RefreshOutcome =
  | { status: 'ok'; token: JWT }
  | { status: 'permanent'; reason: string }
  | { status: 'transient'; reason: string };

/** 만료 이 시간 전부터 미리 갱신한다 (클라이언트 폴링 간격보다 커야 함) */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 90_000;
/** 로그인 응답에 expires_at/expires_in 이 없을 때의 보수적 기본 수명 */
const DEFAULT_ACCESS_TOKEN_LIFETIME_MS = 5 * 60 * 1000;
/**
 * 회전(rotation)된 refresh token 재사용 방지 캐시 TTL.
 * 첫 refresh 가 끝난 직후, 아직 옛 쿠키를 들고 도착한 요청이 폐기된 refresh token 으로
 * IdP 를 다시 호출하면 invalid_grant → 강제 로그아웃이 된다. 그 창(window) 동안은
 * 같은 옛 토큰에 대해 이미 회전된 결과를 재사용한다.
 */
const ROTATED_REFRESH_RESULT_TTL_MS = 60_000;
const TOKEN_ENDPOINT_TIMEOUT_MS = 10_000;

const tokenEndpointCache = new Map<string, string>();
const refreshInFlight = new Map<string, Promise<RefreshOutcome>>();
const rotatedRefreshResults = new Map<
  string,
  { outcome: RefreshOutcome; expiresAt: number }
>();

function readRequiredAuthRuntimeVar(
  key: 'AUTHENTIK_ISSUER' | 'AUTHENTIK_CLIENT_ID' | 'AUTHENTIK_CLIENT_SECRET',
): string {
  const value = getServerRuntimeVar(key).trim();
  if (value.length > 0) {
    return value;
  }

  throw new Error(`Missing required server runtime env: ${key}`);
}

function readAuthRuntimeConfig(): AuthRuntimeConfig {
  return {
    issuer: readRequiredAuthRuntimeVar('AUTHENTIK_ISSUER'),
    clientId: readRequiredAuthRuntimeVar('AUTHENTIK_CLIENT_ID'),
    clientSecret: readRequiredAuthRuntimeVar('AUTHENTIK_CLIENT_SECRET'),
  };
}

async function getTokenEndpoint(issuer: string): Promise<string> {
  const cached = tokenEndpointCache.get(issuer);
  if (cached) {
    return cached;
  }

  const discoveryUrl = new URL(
    '.well-known/openid-configuration',
    issuer.endsWith('/') ? issuer : `${issuer}/`,
  ).toString();

  const response = await fetch(discoveryUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TOKEN_ENDPOINT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC discovery document (${response.status})`,
    );
  }

  const data = (await response.json()) as { token_endpoint?: string };
  if (!data.token_endpoint) {
    throw new Error('OIDC discovery document missing token_endpoint');
  }

  tokenEndpointCache.set(issuer, data.token_endpoint);
  return data.token_endpoint;
}

function pruneRotatedRefreshResults(now: number): void {
  for (const [key, entry] of rotatedRefreshResults) {
    if (entry.expiresAt <= now) {
      rotatedRefreshResults.delete(key);
    }
  }
}

/**
 * 세션을 무효화한 JWT 를 만든다. 만료된 access token 이나 폐기된 refresh token 을
 * 남겨두면 클라이언트가 계속 죽은 토큰으로 API/IdP 를 호출하므로 모두 제거한다.
 */
function invalidateTokens(token: JWT): JWT {
  return {
    ...token,
    accessToken: undefined,
    accessTokenExpires: undefined,
    refreshToken: undefined,
    error: 'RefreshAccessTokenError',
  };
}

async function refreshAccessToken(
  token: JWT,
  config: AuthRuntimeConfig,
): Promise<JWT> {
  const refreshToken = token.refreshToken;
  if (!refreshToken) {
    return invalidateTokens(token);
  }

  const outcome = await refreshWithDedupe(token, refreshToken, config);

  switch (outcome.status) {
    case 'ok':
      return outcome.token;
    case 'permanent':
      return invalidateTokens(token);
    case 'transient':
      // IdP 일시 장애: 기존 토큰을 유지하고 다음 세션 조회에서 재시도한다.
      // 아직 만료 전인 access token 은 계속 쓸 수 있고, 만료됐다면 백엔드 401 →
      // 클라이언트가 세션을 재조회하며 자연스럽게 재시도된다.
      return { ...token, error: undefined };
  }
}

async function refreshWithDedupe(
  token: JWT,
  refreshToken: string,
  config: AuthRuntimeConfig,
): Promise<RefreshOutcome> {
  const now = Date.now();
  pruneRotatedRefreshResults(now);

  const rotated = rotatedRefreshResults.get(refreshToken);
  if (rotated) {
    return rotated.outcome;
  }

  const existing = refreshInFlight.get(refreshToken);
  if (existing) {
    return existing;
  }

  const refresh = refreshAccessTokenUncached(token, refreshToken, config);
  refreshInFlight.set(refreshToken, refresh);

  try {
    const outcome = await refresh;
    if (outcome.status !== 'transient') {
      rotatedRefreshResults.set(refreshToken, {
        outcome,
        expiresAt: Date.now() + ROTATED_REFRESH_RESULT_TTL_MS,
      });
    }
    return outcome;
  } finally {
    if (refreshInFlight.get(refreshToken) === refresh) {
      refreshInFlight.delete(refreshToken);
    }
  }
}

async function refreshAccessTokenUncached(
  token: JWT,
  refreshToken: string,
  config: AuthRuntimeConfig,
): Promise<RefreshOutcome> {
  try {
    const tokenEndpoint = await getTokenEndpoint(config.issuer);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TOKEN_ENDPOINT_TIMEOUT_MS),
    });

    if (response.status >= 500) {
      return {
        status: 'transient',
        reason: `token endpoint responded ${response.status}`,
      };
    }

    const refreshed = (await response.json().catch(() => ({}))) as
      RefreshedTokenResponse;

    if (!response.ok) {
      // invalid_grant(폐기/만료된 refresh token), invalid_client 등 — 재시도 무의미
      return {
        status: 'permanent',
        reason: refreshed.error ?? `token endpoint responded ${response.status}`,
      };
    }

    if (!refreshed.access_token) {
      return {
        status: 'permanent',
        reason: 'token endpoint response missing access_token',
      };
    }

    const lifetimeMs =
      typeof refreshed.expires_in === 'number' && refreshed.expires_in > 0
        ? refreshed.expires_in * 1000
        : DEFAULT_ACCESS_TOKEN_LIFETIME_MS;

    return {
      status: 'ok',
      token: {
        ...token,
        accessToken: refreshed.access_token,
        accessTokenExpires: Date.now() + lifetimeMs,
        refreshToken: refreshed.refresh_token ?? refreshToken,
        error: undefined,
      },
    };
  } catch (error) {
    return {
      status: 'transient',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveAccessTokenExpires(account: {
  expires_at?: number;
  expires_in?: number;
}): number {
  if (typeof account.expires_at === 'number' && account.expires_at > 0) {
    return account.expires_at * 1000;
  }
  if (typeof account.expires_in === 'number' && account.expires_in > 0) {
    return Date.now() + account.expires_in * 1000;
  }
  return Date.now() + DEFAULT_ACCESS_TOKEN_LIFETIME_MS;
}

export function shouldRefreshAccessToken(
  token: Pick<JWT, 'accessToken' | 'accessTokenExpires'>,
  now: number = Date.now(),
): boolean {
  if (!token.accessToken) {
    return true;
  }
  const expiresAt = token.accessTokenExpires;
  if (typeof expiresAt !== 'number') {
    return true;
  }
  return now >= expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

export function createAuthOptions(): NextAuthOptions {
  const authConfig = readAuthRuntimeConfig();
  const authPublicUrl = getAuthPublicUrl();

  return {
    // AUTH_TRUST_HOST가 켜져 있어도 NPM 헤더 변화로 state/PKCE 쿠키 이름이
    // 요청마다 바뀌지 않도록 canonical 공개 URL 기준으로 고정한다.
    useSecureCookies: authPublicUrl.protocol === 'https:',
    pages: {
      signIn: '/auth/signin',
    },
    providers: [
      AuthentikProvider({
        issuer: authConfig.issuer,
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
        checks: ['pkce', 'state'],
        authorization: {
          params: {
            scope: 'openid profile email offline_access',
          },
        },
      }),
    ],
    session: {
      strategy: 'jwt',
    },
    callbacks: {
      async jwt({ token, account }) {
        if (account?.access_token) {
          return {
            ...token,
            accessToken: account.access_token,
            accessTokenExpires: resolveAccessTokenExpires(account),
            refreshToken: account.refresh_token ?? token.refreshToken,
            error: undefined,
          };
        }

        if (!shouldRefreshAccessToken(token)) {
          return token;
        }

        return refreshAccessToken(token, authConfig);
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.error = token.error;
        return session;
      },
    },
  };
}

let cachedAuthOptions: { key: string; options: NextAuthOptions } | undefined;

/**
 * 요청마다 옵션 객체를 재생성하지 않고 재사용한다.
 * 시크릿 회전(Secrets Manager 갱신)으로 설정값이 바뀐 경우에만 다시 만든다.
 */
export function getAuthOptions(): NextAuthOptions {
  const key = [
    getServerRuntimeVar('NEXTAUTH_URL'),
    getServerRuntimeVar('AUTHENTIK_ISSUER'),
    getServerRuntimeVar('AUTHENTIK_CLIENT_ID'),
    getServerRuntimeVar('AUTHENTIK_CLIENT_SECRET'),
  ].join('\u0000');

  if (!cachedAuthOptions || cachedAuthOptions.key !== key) {
    cachedAuthOptions = { key, options: createAuthOptions() };
  }
  return cachedAuthOptions.options;
}

/** 테스트 전용: 모듈 캐시 초기화 */
export function __resetAuthCachesForTests(): void {
  tokenEndpointCache.clear();
  refreshInFlight.clear();
  rotatedRefreshResults.clear();
  cachedAuthOptions = undefined;
}
