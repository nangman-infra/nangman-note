'use client';

import { memo } from 'react';
import { Clock3, Hourglass, Sparkles } from 'lucide-react';
import type { Meeting } from '../types/meeting.types';
import { formatDate, formatDuration } from '@/lib/utils/date';

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  isActive?: boolean;
}

const statusConfig = {
  recording: {
    label: '진행 중',
    className: 'bg-red-100 text-red-700',
    icon: Sparkles,
  },
  processing: {
    label: '정리 중',
    className: 'bg-amber-100 text-amber-700',
    icon: Hourglass,
  },
  completed: {
    label: '완료',
    className: 'bg-emerald-100 text-emerald-700',
    icon: Clock3,
  },
} as const;

export const MeetingCard = memo(({ meeting, onClick, isActive }: MeetingCardProps) => {
  const duration = meeting.endedAt
    ? (new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000
    : 0;

  const config = statusConfig[meeting.status];
  const StatusIcon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface-card w-full p-4 text-left transition ${
        isActive
          ? 'border-[var(--line-strong)] bg-white shadow-[0_16px_30px_rgba(17,94,89,0.12)]'
          : 'hover:-translate-y-0.5 hover:border-[var(--line-strong)]'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{meeting.title || '제목 없는 회의'}</h3>
        <span className={`status-pill inline-flex items-center gap-1 ${config.className}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>{formatDate(meeting.startedAt)}</p>
        {duration > 0 ? <p>{formatDuration(duration)}</p> : <p>녹화 대기 중</p>}
      </div>
    </button>
  );
});

MeetingCard.displayName = 'MeetingCard';
