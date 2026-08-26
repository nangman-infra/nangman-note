'use client';

import { useEffect, useRef } from 'react';

/**
 * 브라우저 뒤로가기(popstate)가 진행 중인 작업(녹음/업로드)을 파괴하지 않도록
 * history sentinel 항목으로 가드합니다.
 *
 * beforeunload 는 탭 닫기/새로고침만 막고 SPA 뒤로가기는 막지 못하므로,
 * 가드 활성 시 동일 URL 의 sentinel 항목을 push 해 두고 popstate 가 오면
 * sentinel 을 다시 push 한 뒤 onBlocked 콜백(종료 다이얼로그 등)을 호출합니다.
 *
 * @param shouldBlock - true 이면 뒤로가기 가드 활성화
 * @param onBlocked - 뒤로가기가 차단됐을 때 호출 (예: 종료 확인 다이얼로그 열기)
 */
export function useHistoryBackGuard(
  shouldBlock: boolean,
  onBlocked: () => void,
): void {
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    if (!shouldBlock) return;

    const hasSentinel = () =>
      Boolean(
        (window.history.state as { __backGuard?: boolean } | null)
          ?.__backGuard,
      );

    // sentinel: 뒤로가기가 페이지 이탈 대신 이 항목을 먼저 소비하게 한다.
    // 가드가 재활성화(장치 변경 등)돼도 sentinel 이 누적되지 않게 한다.
    if (!hasSentinel()) {
      window.history.pushState(
        { __backGuard: true },
        '',
        window.location.href,
      );
    }

    const handlePopState = () => {
      // sentinel 재장전 후 사용자에게 종료 절차를 안내한다.
      if (!hasSentinel()) {
        window.history.pushState(
          { __backGuard: true },
          '',
          window.location.href,
        );
      }
      onBlockedRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlock]);
}
