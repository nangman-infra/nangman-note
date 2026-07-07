'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession, signIn } from 'next-auth/react';
import { setAccessToken } from '@/lib/auth/access-token-store';

/**
 * 세션에서 accessToken 을 in-memory store 에 동기화.
 * - session.error === 'RefreshAccessTokenError' 이면 refresh token 도 만료된 것이므로
 *   자동으로 재로그인 유도.
 */
function SessionTokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      // refresh token 마저 만료 → 재로그인
      setAccessToken(undefined);
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : '/';
      void signIn('authentik', { callbackUrl });
      return;
    }
    setAccessToken(session?.accessToken);
  }, [session?.accessToken, session?.error]);

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
