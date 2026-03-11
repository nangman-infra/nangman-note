'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // SSR always assumes online — no hydration mismatch
}

export function NetworkStatusBanner() {
  const isOnline = useSyncExternalStore(subscribeOnlineStatus, getOnlineSnapshot, getServerSnapshot);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white">
      <WifiOff className="mr-2 inline-block h-4 w-4" />
      네트워크 연결이 끊어졌습니다. 노트는 로컬에 임시 저장됩니다.
    </div>
  );
}
