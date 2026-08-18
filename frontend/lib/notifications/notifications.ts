'use client';

/**
 * 회의 완료 알림 저장소 (localStorage 기반).
 * 알림 벨 목록·읽음 처리·브라우저 Web Notification 발송을 담당합니다.
 */

const NOTIFICATIONS_KEY = 'transnote_notifications';
const NOTIFY_ON_COMPLETE_KEY = 'transnote_notify_on_complete';
const MAX_NOTIFICATIONS = 50;

export interface AppNotification {
  id: string;
  meetingId: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AppNotification =>
        Boolean(item) &&
        typeof (item as AppNotification).id === 'string' &&
        typeof (item as AppNotification).meetingId === 'string',
    );
  } catch {
    return [];
  }
}

function persistNotifications(notifications: AppNotification[]): void {
  try {
    localStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)),
    );
  } catch {
    // localStorage 실패는 무해
  }
}

export function addNotification(input: {
  meetingId: string;
  title: string;
  message: string;
}): AppNotification[] {
  const existing = loadNotifications();

  // 같은 회의의 짧은 시간 내 중복 알림 방지 (WS + 폴링 이중 수신)
  const DEDUPE_WINDOW_MS = 60_000;
  const isDuplicate = existing.some(
    (notification) =>
      notification.meetingId === input.meetingId &&
      Date.now() - notification.createdAt < DEDUPE_WINDOW_MS,
  );
  if (isDuplicate) return existing;

  const next: AppNotification[] = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      meetingId: input.meetingId,
      title: input.title,
      message: input.message,
      createdAt: Date.now(),
      read: false,
    },
    ...existing,
  ].slice(0, MAX_NOTIFICATIONS);

  persistNotifications(next);
  return next;
}

export function markAllNotificationsRead(): AppNotification[] {
  const next = loadNotifications().map((notification) => ({
    ...notification,
    read: true,
  }));
  persistNotifications(next);
  return next;
}

export function clearNotifications(): AppNotification[] {
  persistNotifications([]);
  return [];
}

/* ── 완료 알림 설정 (Web Notification) ── */

export function isNotifyOnCompleteEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIFY_ON_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export async function setNotifyOnCompleteEnabled(
  enabled: boolean,
): Promise<'enabled' | 'disabled' | 'permission-denied' | 'unsupported'> {
  if (!enabled) {
    try {
      localStorage.setItem(NOTIFY_ON_COMPLETE_KEY, 'false');
    } catch {
      // 무해
    }
    return 'disabled';
  }

  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return 'permission-denied';
  }

  try {
    localStorage.setItem(NOTIFY_ON_COMPLETE_KEY, 'true');
  } catch {
    // 무해
  }
  return 'enabled';
}

/** 탭이 백그라운드일 때 브라우저 알림 발송 (설정·권한 충족 시) */
export function showBrowserNotificationIfEnabled(input: {
  title: string;
  body: string;
}): void {
  if (typeof Notification === 'undefined') return;
  if (!isNotifyOnCompleteEnabled()) return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // 포그라운드에서는 인앱 토스트/벨로 충분
    return;
  }

  try {
    new Notification(input.title, { body: input.body, icon: '/icon' });
  } catch {
    // 일부 플랫폼(모바일 크롬)은 페이지 컨텍스트 알림 미지원 — 무해
  }
}
