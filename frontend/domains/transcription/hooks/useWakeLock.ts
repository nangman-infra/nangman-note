'use client';

import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

/**
 * 녹음/스트리밍 중 화면 잠금으로 오디오 캡처가 중단되는 것을 방지하는
 * Screen Wake Lock 훅.
 *
 * - active 동안 wake lock을 유지하고, 탭이 다시 보이면 재획득합니다
 *   (브라우저는 탭이 백그라운드로 가면 wake lock을 자동 해제).
 * - Wake Lock API 미지원 브라우저에서는 조용히 no-op.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;

    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (disposed) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // 배터리 절약 모드 등으로 거부될 수 있음 — 기능 저하로 수용
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => undefined);
      }
    };
  }, [active]);
}
