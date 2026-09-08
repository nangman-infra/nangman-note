import { getSession } from 'next-auth/react';
import { getAccessToken, setAccessToken } from './access-token-store';

let inFlight: Promise<string | undefined> | null = null;

/**
 * NextAuth 세션에서 사용 가능한 액세스 토큰을 가져온다.
 *
 * - `/api/auth/session` 호출은 JWT 콜백을 실행하므로, 서버가 필요 시 refresh를 수행한다.
 * - 동시 호출은 1개의 요청으로 합쳐진다(dedupe). 병렬 호출마다 세션 쿠키가 따로 갱신되어
 *   refresh token 회전과 경합하는 문제를 줄인다.
 * - 세션이 없거나(`null`) 에러 상태이면 `undefined`를 반환하고 인메모리 토큰을 비운다.
 */
export function fetchSessionAccessToken(): Promise<string | undefined> {
  if (!inFlight) {
    inFlight = getSession()
      .then((session) => {
        if (!session || session.error || !session.accessToken) {
          setAccessToken(undefined);
          return undefined;
        }
        setAccessToken(session.accessToken, session.accessTokenExpires);
        return session.accessToken;
      })
      .catch(() => {
        setAccessToken(undefined);
        return undefined;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * 인메모리 토큰이 있으면 즉시 반환하고, 없으면 세션에서 가져온다.
 */
export async function resolveAccessToken(): Promise<string | undefined> {
  return getAccessToken() ?? fetchSessionAccessToken();
}
