import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/jwt', () => ({
  getToken: getTokenMock,
}));

import { proxy } from './proxy';

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(path, 'https://app.example.com'), { headers });
}

describe('proxy', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    process.env.BACKEND_URL = 'http://localhost:9999';
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.BACKEND_URL;
    delete process.env.NEXTAUTH_URL;
  });

  describe('canonical auth origin', () => {
    it('redirects an alias host before an OAuth state cookie can be created', async () => {
      const response = await proxy(
        request('/auth/signin?callbackUrl=%2F', {
          'x-forwarded-host': 'www.app.example.com',
          'x-forwarded-proto': 'https',
        }),
      );

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(
        'https://app.example.com/auth/signin?callbackUrl=%2F',
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(getTokenMock).not.toHaveBeenCalled();
    });

    it('accepts the canonical origin forwarded by NPM', async () => {
      const forwardedRequest = new NextRequest(
        'http://127.0.0.1:3002/api/auth/session',
        {
          headers: {
            host: '127.0.0.1:3002',
            'x-forwarded-host': 'app.example.com',
            'x-forwarded-proto': 'https',
          },
        },
      );

      const response = await proxy(forwardedRequest);

      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(getTokenMock).not.toHaveBeenCalled();
    });

    it('does not redirect the internal health check to the public origin', async () => {
      const healthRequest = new NextRequest('http://127.0.0.1:3002/api/health');

      const response = await proxy(healthRequest);

      expect(response.headers.get('x-middleware-next')).toBe('1');
    });
  });

  describe('protected pages', () => {
    it('redirects anonymous navigation to the sign-in page with a callbackUrl', async () => {
      getTokenMock.mockResolvedValue(null);

      const response = await proxy(request('/meeting/123?tab=notes'));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') ?? '');
      expect(location.pathname).toBe('/auth/signin');
      expect(location.searchParams.get('callbackUrl')).toBe('/meeting/123?tab=notes');
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('answers prefetches with an empty 204 instead of a redirect', async () => {
      getTokenMock.mockResolvedValue(null);

      const response = await proxy(request('/', { 'next-router-prefetch': '1' }));

      expect(response.status).toBe(204);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('lets a logged-in user through', async () => {
      getTokenMock.mockResolvedValue({ accessToken: 'a' });

      const response = await proxy(request('/'));

      expect(response.headers.get('x-middleware-next')).toBe('1');
    });

    it('lets a broken session (no access token) reach the page so the client can re-login', async () => {
      getTokenMock.mockResolvedValue({ error: 'RefreshAccessTokenError' });

      const response = await proxy(request('/settings'));

      expect(response.headers.get('x-middleware-next')).toBe('1');
    });
  });

  describe('backend API gate', () => {
    it('rewrites authenticated API calls to the runtime BACKEND_URL', async () => {
      getTokenMock.mockResolvedValue({ accessToken: 'a' });

      const response = await proxy(request('/api/v1/meetings?page=1&limit=50'));

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'http://localhost:9999/api/v1/meetings?page=1&limit=50',
      );
    });

    it('rejects anonymous API calls with a backend-shaped 401 JSON', async () => {
      getTokenMock.mockResolvedValue(null);

      const response = await proxy(request('/api/v1/meetings?page=1&limit=50'));

      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'Unauthenticated',
          statusCode: 401,
          path: '/api/v1/meetings',
        },
      });
    });

    it('rejects sessions that have no usable access token', async () => {
      getTokenMock.mockResolvedValue({ error: 'RefreshAccessTokenError' });

      const response = await proxy(request('/api/v1/prompts'));

      expect(response.status).toBe(401);
    });

    it('never gates NextAuth or health endpoints', async () => {
      getTokenMock.mockResolvedValue(null);

      const session = await proxy(request('/api/auth/session'));
      const health = await proxy(request('/api/health'));

      expect(session.headers.get('x-middleware-next')).toBe('1');
      expect(health.headers.get('x-middleware-next')).toBe('1');
      expect(getTokenMock).not.toHaveBeenCalled();
    });

    it('gates websocket handshakes the same way', async () => {
      getTokenMock.mockResolvedValue({ accessToken: 'a' });

      const response = await proxy(request('/ws/meeting-status'));

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'http://localhost:9999/ws/meeting-status',
      );
    });
  });
});
