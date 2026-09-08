import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAccessToken,
  getAccessToken,
  requestReauthentication,
} from '@/lib/auth/access-token-store';
import {
  fetchSessionAccessToken,
  resolveAccessToken,
} from '@/lib/auth/session-token';
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

/** 세션이 없어 요청을 보내지 않고 거절했을 때의 에러 코드 */
export const UNAUTHENTICATED_ERROR_CODE = 'Unauthenticated';
export const UNAUTHENTICATED_MESSAGE = '로그인이 필요합니다. 다시 로그인해주세요.';

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readBearerToken(
  headers: InternalAxiosRequestConfig['headers'] | undefined,
): string | undefined {
  const value = headers?.Authorization;
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1];
}

// 요청 인터셉터: 유효한 액세스 토큰이 있을 때만 요청을 보낸다.
// 토큰이 없으면 백엔드에 헤더 없는 요청(→ 401 노이즈)을 보내지 않고 즉시 거절 + 재인증 요청.
apiClient.interceptors.request.use(
  async (config) => {
    // SSR/테스트 환경: 세션 조회 없이 인메모리 토큰만 사용 (기존 동작 유지)
    if (!isBrowser() || env.MODE === 'test') {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }

    const token = await resolveAccessToken();
    if (!token) {
      requestReauthentication('session-missing');
      throw new ApiError({
        message: UNAUTHENTICATED_MESSAGE,
        code: UNAUTHENTICATED_ERROR_CODE,
        statusCode: 401,
        path: config.url,
      });
    }

    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// 응답 인터셉터: 401 시 세션 재조회(서버 refresh) 후 1회 재시도 + 에러 메시지 표준화
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 요청 인터셉터에서 이미 표준화된 에러는 그대로 전파
    if (error instanceof ApiError) {
      return Promise.reject(error);
    }

    if (error instanceof AxiosError) {
      const originalRequest = error.config as RetriableRequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        isBrowser()
      ) {
        originalRequest._retry = true;
        const failedToken = readBearerToken(originalRequest.headers);

        // 거절된 토큰은 폐기하고 세션에서 새 토큰을 받는다 (JWT 콜백이 필요 시 refresh).
        clearAccessToken();
        const newToken = await fetchSessionAccessToken();

        if (newToken && newToken !== failedToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }

        if (!newToken) {
          // 세션 자체가 사라짐 → 재로그인 유도 (반복 401 방지)
          requestReauthentication('session-missing');
        }
        // 같은 토큰이 다시 나온 경우: 서버 설정/시각 문제이므로 재시도하지 않고 에러 전파
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
