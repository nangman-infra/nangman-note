import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import AuthentikProvider from 'next-auth/providers/authentik';
import { getServerRuntimeVar } from '@/lib/config/env';

const authentikIssuer =
  getServerRuntimeVar('AUTHENTIK_ISSUER') ||
  'http://localhost:9000/application/o/transnote/';
const authentikClientId =
  getServerRuntimeVar('AUTHENTIK_CLIENT_ID') || 'dev-authentik-client-id';
const authentikClientSecret =
  getServerRuntimeVar('AUTHENTIK_CLIENT_SECRET') ||
  'dev-authentik-client-secret';

let cachedTokenEndpoint: string | undefined;

async function getTokenEndpoint(): Promise<string> {
  if (cachedTokenEndpoint) {
    return cachedTokenEndpoint;
  }

  const discoveryUrl = new URL(
    '.well-known/openid-configuration',
    authentikIssuer.endsWith('/') ? authentikIssuer : `${authentikIssuer}/`,
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

  cachedTokenEndpoint = data.token_endpoint;
  return cachedTokenEndpoint;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    const tokenEndpoint = await getTokenEndpoint();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: authentikClientId,
      client_secret: authentikClientSecret,
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

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    AuthentikProvider({
      issuer: authentikIssuer,
      clientId: authentikClientId,
      clientSecret: authentikClientSecret,
      checks: ['pkce', 'state'],
      authorization: {
        params: {
          scope: 'openid profile email offline_access',
        },
      },
    }),
  ],
  debug: true,
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

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};
