'use client';

import { useSession } from 'next-auth/react';

/**
 * API 호출을 시작해도 되는 인증 상태인지.
 * - 세션이 로드됐고(authenticated)
 * - access token 이 있으며
 * - refresh 실패(error) 상태가 아닐 때만 true.
 *
 * 데이터 fetch/폴링 effect 는 이 값이 true 일 때만 동작해야 한다.
 * (false 인 상태에서 요청하면 apiClient 가 즉시 거절하고 재인증을 유도한다.)
 */
export function useAuthReady(): boolean {
  const { data: session, status } = useSession();
  return (
    status === 'authenticated' &&
    Boolean(session?.accessToken) &&
    !session?.error
  );
}
