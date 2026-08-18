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
      // production 백엔드는 500을 'Internal server error'로 마스킹하므로
      // 그대로 노출하지 않고 한국어 안내로 대체한다.
      const rawServerMessage = payload?.error?.message;
      const serverMessage =
        rawServerMessage === 'Internal server error' ? null : rawServerMessage;
      const message =
        serverMessage ||
        translateAxiosErrorMessage(error) ||
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
  },
);

/**
 * axios가 만든 영문 저수준 에러("timeout of 30000ms exceeded",
 * "Network Error" 등)를 사용자에게 그대로 노출하지 않도록 한국어로 변환.
 */
function translateAxiosErrorMessage(error: AxiosError): string | null {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
  }
  if (error.code === 'ERR_NETWORK') {
    return '네트워크 연결을 확인해주세요. 서버에 연결할 수 없습니다.';
  }
  if (error.code === 'ERR_CANCELED') {
    return '요청이 취소되었습니다.';
  }

  const status = error.response?.status;
  if (status !== undefined) {
    if (status >= 500) {
      return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    if (status === 404) {
      return '요청한 데이터를 찾을 수 없습니다.';
    }
    if (status === 403) {
      return '이 작업을 수행할 권한이 없습니다.';
    }
    if (status === 401) {
      return '인증이 만료되었습니다. 다시 로그인해주세요.';
    }
    if (status === 400) {
      return '요청을 처리할 수 없습니다. 입력 내용을 확인해주세요.';
    }
  }

  return error.message || null;
}