'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SessionProvider, useSession, signIn } from 'next-auth/react';
import {
  clearAccessToken,
  onReauthenticationRequested,
  setAccessToken,
  type ReauthenticationReason,
} from '@/lib/auth/access-token-store';
import {
  buildCallbackUrl,
  isAuthPath,
  isProtectedPath,
} from '@/lib/auth/route-policy';

/**
 * 세션 ↔ 인메모리 access token 동기화 + 재인증 트리거.
 *
 * 처리하는 상태:
 * - authenticated + accessToken 있음  → 토큰 저장 (정상)
 * - authenticated + error / 토큰 없음 → refresh token 까지 만료. Authentik SSO 세션이 살아있으면
 *                                      무중단으로 재로그인되므로 signIn('authentik') 로 바로 보낸다.
 * - unauthenticated                  → 세션 쿠키가 사라짐(만료·시크릿 교체·로그아웃). 보호 페이지에서는
 *                                      로그인 페이지로 보낸다. (SPA 는 페이지 이동이 없으면 proxy.ts 의
 *                                      리다이렉트가 동작하지 않으므로 여기서 처리해야 한다.)
 * - apiClient 가 토큰 없이 요청을 거절한 경우(requestReauthentication) 도 같은 경로로 처리.
 *
 * signIn()/location 이동은 full-page navigation 이라 탭 수명 동안 1회만 실행한다.
 * 인증 페이지(/auth/*) 에서는 자동 리다이렉트를 하지 않는다 (루프 방지, 로그아웃 흐름 보호).
 */
function SessionTokenSync() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const redirectStartedRef = useRef(false);

  const startReauthentication = useCallback(
    (reason: ReauthenticationReason) => {
      if (typeof window === 'undefined') return;
      if (redirectStartedRef.current) return;

      const currentPath = window.location.pathname;
      if (isAuthPath(currentPath) || isAuthPath(pathname)) return;
      // 공개 페이지(랜딩, 약관 등)에서는 로그인을 강제하지 않는다.
      if (!isProtectedPath(currentPath)) return;

      redirectStartedRef.current = true;
      const callbackUrl = buildCallbackUrl(
        currentPath,
        window.location.search,
        window.location.hash,
      );

      if (reason === 'session-error') {
        // 세션은 있지만 토큰이 깨진 상태 → IdP 로 직접 이동해 SSO 재로그인
        void signIn('authentik', { callbackUrl });
        return;
      }

      const signInUrl = new URL('/auth/signin', window.location.origin);
      signInUrl.searchParams.set('callbackUrl', callbackUrl);
      window.location.assign(signInUrl.toString());
    },
    [pathname],
  );

  // apiClient 가 토큰 부재로 요청을 거절했을 때의 신호를 구독
  useEffect(
    () => onReauthenticationRequested(startReauthentication),
    [startReauthentication],
  );

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      clearAccessToken();
      startReauthentication('session-missing');
      return;
    }

    if (session?.error || !session?.accessToken) {
      clearAccessToken();
      startReauthentication('session-error');
      return;
    }

    setAccessToken(session.accessToken, session.accessTokenExpires);
  }, [
    status,
    session?.accessToken,
    session?.accessTokenExpires,
    session?.error,
    startReauthentication,
  ]);

  return null;
}

interface AuthSessionProviderProps {
  children: React.ReactNode;
}

/**
 * refetchInterval : 4분(240초)마다 서버에 세션 재요청 → JWT 콜백이 access token 갱신.
 * refetchOnWindowFocus : 탭 전환 후 돌아올 때도 즉시 세션 갱신.
 */
export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider refetchInterval={240} refetchOnWindowFocus={true}>
      <SessionTokenSync />
      {children}
    </SessionProvider>
  );
}
