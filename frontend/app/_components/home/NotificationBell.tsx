'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import {
  addNotification,
  clearNotifications,
  loadNotifications,
  markAllNotificationsRead,
  showBrowserNotificationIfEnabled,
  type AppNotification,
} from '@/lib/notifications/notifications';

interface NotificationBellProps {
  onSelectMeeting?: (meetingId: string | null) => void;
}

export function NotificationBell({ onSelectMeeting }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(loadNotifications()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleStatusChange = useCallback(
    (message: { meetingId: string; status: string }) => {
      if (message.status !== 'completed') return;

      const next = addNotification({
        meetingId: message.meetingId,
        title: '회의록이 준비되었습니다',
        message: '전사와 AI 회의록 생성이 완료되었습니다. 결과를 확인하세요.',
      });
      setNotifications(next);
      showBrowserNotificationIfEnabled({
        title: 'TransNote — 회의록 준비 완료',
        body: 'AI 회의록 생성이 완료되었습니다. 결과를 확인하세요.',
      });
    },
    [],
  );

  useMeetingStatus({ onStatusChange: handleStatusChange });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    const willOpen = !isOpen;
    // setState updater는 순수해야 하므로 부수효과(읽음 처리)는 밖에서 수행
    if (willOpen && unreadCount > 0) {
      setNotifications(markAllNotificationsRead());
    }
    setIsOpen(willOpen);
  };

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-full p-2 text-slate-500 transition hover:bg-indigo-50"
        aria-label={`알림 ${unreadCount > 0 ? `(읽지 않음 ${unreadCount}개)` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              알림
            </p>
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={() => setNotifications(clearNotifications())}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-rose-600"
              >
                <Trash2 className="h-3 w-3" />
                모두 지우기
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <CheckCheck className="h-5 w-5 text-slate-300" />
              <p className="text-xs text-slate-400">새 알림이 없습니다</p>
              <p className="text-[11px] text-slate-300">
                회의록이 완성되면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSelectMeeting?.(notification.meetingId);
                    }}
                    className="block w-full rounded-lg px-2 py-2 text-left transition hover:bg-indigo-50/60"
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatNotificationTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Date(timestamp).toLocaleDateString('ko-KR');
}
