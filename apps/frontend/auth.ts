import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import AuthentikProvider from 'next-auth/providers/authentik';
import { getServerRuntimeVar } from '@/lib/config/env';

interface AuthRuntimeConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

const tokenEndpointCache = new Map<string, string>();

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

  const response = await fetch(discoveryUrl, { cache: 'no-store' });
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

async function refreshAccessToken(
  token: JWT,
  config: AuthRuntimeConfig,
): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    const tokenEndpoint = await getTokenEndpoint(config.issuer);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!response.ok || !refreshed.access_token || !refreshed.expires_in) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export function createAuthOptions(): NextAuthOptions {
  const authConfig = readAuthRuntimeConfig();

  return {
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
            accessTokenExpires: account.expires_at
              ? account.expires_at * 1000
              : Date.now() + 60 * 60 * 1000,
            refreshToken: account.refresh_token ?? token.refreshToken,
            error: undefined,
          };
        }

        const expiresAt = token.accessTokenExpires;
        if (typeof expiresAt === 'number' && Date.now() < expiresAt - 30_000) {
          return token;
        }

        return refreshAccessToken(token, authConfig);
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken;
        session.error = token.error;
        return session;
      },
    },
  };
}
