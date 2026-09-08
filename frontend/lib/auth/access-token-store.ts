/**
 * 브라우저 인메모리 액세스 토큰 저장소.
 *
 * - `SessionTokenSync`(AuthSessionProvider)가 NextAuth 세션에서 토큰을 동기화한다.
 * - `apiClient`는 요청 직전에 여기서 토큰을 읽는다. 만료(임박) 토큰은 없는 것으로 취급해
 *   세션 재조회(서버 측 refresh)를 유도한다.
 * - 토큰이 전혀 없을 때는 `requestReauthentication()`으로 재인증이 필요하다는 신호를
 *   리스너(AuthSessionProvider)에 전달한다. axios 레이어는 라우팅/로그인 UX를 알지 않는다.
 */

/** 만료 직전 토큰을 미리 폐기하기 위한 여유 시간 (네트워크 지연 + 서버 clockTolerance 고려) */
export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 10_000;

export type ReauthenticationReason = 'session-missing' | 'session-error';
export type ReauthenticationListener = (reason: ReauthenticationReason) => void;

interface StoredAccessToken {
  token: string;
  expiresAt?: number;
}

let stored: StoredAccessToken | undefined;
const listeners = new Set<ReauthenticationListener>();

export function setAccessToken(token?: string, expiresAt?: number): void {
  if (!token) {
    stored = undefined;
    return;
  }
  stored = {
    token,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined,
  };
}

export function clearAccessToken(): void {
  stored = undefined;
}

/**
 * 사용 가능한 액세스 토큰을 반환한다. 만료(임박) 토큰은 `undefined`.
 */
export function getAccessToken(now: number = Date.now()): string | undefined {
  if (!stored) {
    return undefined;
  }
  if (
    typeof stored.expiresAt === 'number' &&
    now >= stored.expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS
  ) {
    stored = undefined;
    return undefined;
  }
  return stored.token;
}

export function onReauthenticationRequested(
  listener: ReauthenticationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestReauthentication(reason: ReauthenticationReason): void {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch {
      // 리스너 오류가 API 호출 흐름을 깨뜨리지 않도록 무시
    }
  }
}
