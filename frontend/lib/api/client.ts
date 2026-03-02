import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import { getAccessToken, setAccessToken } from '@/lib/auth/access-token-store';
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
  (error) => Promise.reject(error),
);

// 응답 인터셉터: 401 시 세션 갱신 후 1회 재시도 + 에러 메시지 표준화
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error instanceof AxiosError) {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // 401 && 아직 재시도하지 않은 요청 → 세션 갱신 후 재시도
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        typeof window !== 'undefined'
      ) {
        originalRequest._retry = true;

        try {
          // getSession()은 서버에 /api/auth/session 을 요청 → JWT 콜백에서 refresh
          const session = await getSession();
          const newToken = session?.accessToken;

          if (newToken) {
            setAccessToken(newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          }
        } catch {
          // 갱신 실패 시 그대로 에러 전파
        }
      }

      const payload = error.response?.data as ErrorPayload | undefined;
      const message =
        payload?.error?.message || error.message || '오류가 발생했습니다';

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
  },
);