'use client';

import { useEffect } from 'react';

/**
 * 녹음 중이거나 저장 안 된 변경사항이 있을 때
 * 탭 닫기/새로고침을 방지하는 브라우저 기본 경고를 활성화합니다.
 *
 * @param shouldBlock - true이면 beforeunload 경고 활성화
 */
export function useBeforeUnloadGuard(shouldBlock: boolean): void {
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 최신 브라우저에서는 returnValue를 설정해야 경고가 표시됨
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [shouldBlock]);
}