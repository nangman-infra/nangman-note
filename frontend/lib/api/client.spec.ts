// @vitest-environment jsdom

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/react', () => ({
  getSession: getSessionMock,
}));

// 실제 브라우저 경로(세션 조회·차단·재시도)를 검증하기 위해 test 모드 바이패스를 끈다.
vi.mock('@/lib/config/env', () => ({
  env: { MODE: 'development', API_URL: '' },
}));

import {
  clearAccessToken,
  onReauthenticationRequested,
  setAccessToken,
} from '@/lib/auth/access-token-store';
import { ApiError, UNAUTHENTICATED_ERROR_CODE, apiClient } from './client';

type AdapterCall = { url?: string; authorization?: string };

function okResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    data: {
      success: false,
      error: {
        code: 'UnauthorizedException',
        statusCode: 401,
        message: 'Invalid access token',
        path: config.url,
      },
    },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  };
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response);
}

function installAdapter(
  handler: (config: InternalAxiosRequestConfig, calls: AdapterCall[]) => Promise<AxiosResponse>,
): AdapterCall[] {
  const calls: AdapterCall[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const headers = AxiosHeaders.from(config.headers);
    calls.push({
      url: config.url,
      authorization: headers.get('Authorization') as string | undefined,
    });
    return handler(config, calls);
  };
  apiClient.defaults.adapter = adapter;
  return calls;
}

describe('apiClient auth interceptors', () => {
  const reauthListener = vi.fn();
  let unsubscribe: () => void;

  beforeEach(() => {
    clearAccessToken();
    getSessionMock.mockReset();
    reauthListener.mockReset();
    unsubscribe = onReauthenticationRequested(reauthListener);
  });

  afterEach(() => {
    unsubscribe();
  });

  it('attaches the in-memory token without consulting the session', async () => {
    setAccessToken('cached-token');
    const calls = installAdapter(async (config) => okResponse(config, { ok: true }));

    await apiClient.get('/api/v1/meetings');

    expect(calls).toEqual([
      { url: '/api/v1/meetings', authorization: 'Bearer cached-token' },
    ]);
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('fetches the token from the session when the store is empty', async () => {
    getSessionMock.mockResolvedValue({ accessToken: 'session-token' });
    const calls = installAdapter(async (config) => okResponse(config, {}));

    await apiClient.get('/api/v1/prompts');

    expect(calls[0]?.authorization).toBe('Bearer session-token');
  });

  it('refuses to send a request without a token and asks for re-authentication', async () => {
    getSessionMock.mockResolvedValue(null);
    const calls = installAdapter(async (config) => okResponse(config, {}));

    const error = await apiClient.get('/api/v1/meetings').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(UNAUTHENTICATED_ERROR_CODE);
    expect((error as ApiError).statusCode).toBe(401);
    expect(calls).toHaveLength(0);
    expect(reauthListener).toHaveBeenCalledWith('session-missing');
  });

  it('retries once with a fresh token after a 401', async () => {
    setAccessToken('expired-token');
    getSessionMock.mockResolvedValue({ accessToken: 'fresh-token' });
    const calls = installAdapter(async (config, seen) => {
      if (seen.length === 1) {
        throw unauthorizedError(config);
      }
      return okResponse(config, { retried: true });
    });

    const response = await apiClient.get('/api/v1/meetings');

    expect(response.data).toEqual({ retried: true });
    expect(calls.map((call) => call.authorization)).toEqual([
      'Bearer expired-token',
      'Bearer fresh-token',
    ]);
    expect(reauthListener).not.toHaveBeenCalled();
  });

  it('does not retry when the session returns the same rejected token', async () => {
    setAccessToken('rejected-token');
    getSessionMock.mockResolvedValue({ accessToken: 'rejected-token' });
    const calls = installAdapter(async (config) => {
      throw unauthorizedError(config);
    });

    const error = await apiClient.get('/api/v1/meetings').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(401);
    expect((error as ApiError).message).toBe('Invalid access token');
    expect(calls).toHaveLength(1);
    expect(reauthListener).not.toHaveBeenCalled();
  });

  it('requests re-authentication when the session is gone after a 401', async () => {
    setAccessToken('expired-token');
    getSessionMock.mockResolvedValue(null);
    const calls = installAdapter(async (config) => {
      throw unauthorizedError(config);
    });

    await expect(apiClient.get('/api/v1/meetings')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    expect(reauthListener).toHaveBeenCalledWith('session-missing');
  });
});
