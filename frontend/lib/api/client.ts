import axios, { AxiosError } from 'axios';
import { getSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth/access-token-store';
import { env } from '@/lib/config/env';

interface ErrorPayload {
  success?: false;
  error?: {
    code?: string;
    statusCode?: number;
    message?: string;
    path?: string;
    timestamp?: string;
  };
}

export class ApiError extends Error {
  readonly code?: string;
  readonly statusCode?: number;
  readonly path?: string;

  constructor(params: {
    message: string;
    code?: string;
    statusCode?: number;
    path?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.path = params.path;
  }
}

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  async (config) => {
    let token = getAccessToken();
    if (!token && env.MODE !== 'test' && typeof window !== 'undefined') {
      const session = await getSession();
      token = session?.accessToken;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 (에러 메시지 표준화)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error instanceof AxiosError) {
      const payload = error.response?.data as ErrorPayload | undefined;
      const message =
        payload?.error?.message ||
        error.message ||
        '오류가 발생했습니다';

      return Promise.reject(
        new ApiError({
          message,
          code: payload?.error?.code,
          statusCode: payload?.error?.statusCode ?? error.response?.status,
          path: payload?.error?.path,
        }),
      );
    }

    const fallbackMessage =
      error instanceof Error ? error.message : '오류가 발생했습니다';
    return Promise.reject(new ApiError({ message: fallbackMessage }));
  }
);
