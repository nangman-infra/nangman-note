'use client';

import { memo } from 'react';
import { Clock3, Hourglass, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { Meeting } from '../types/meeting.types';
import { formatDate, formatDuration } from '@/lib/utils/date';

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
  mode?: 'active' | 'trash';
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

export const MeetingCard = memo(
  ({
    meeting,
    onClick,
    onDelete,
    onRestore,
    onPurge,
    mode = 'active',
    isActive,
  }: MeetingCardProps) => {
    const duration = meeting.endedAt
      ? (new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000
      : 0;

    const config = statusConfig[meeting.status];
    const StatusIcon = config.icon;

    return (
      <article
        className={`surface-card w-full p-4 transition ${
          isActive
            ? 'border-[var(--line-strong)] bg-white shadow-[0_16px_30px_rgba(17,94,89,0.12)]'
            : 'hover:-translate-y-0.5 hover:border-[var(--line-strong)]'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClick}
            className="min-w-0 flex-1 text-left"
            disabled={mode === 'trash'}
          >
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
              {meeting.title || '제목 없는 회의'}
            </h3>
          </button>

          <div className="flex items-center gap-1.5">
            {mode === 'active' && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-700"
                aria-label="회의 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span className={`status-pill inline-flex items-center gap-1 ${config.className}`}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClick}
          disabled={mode === 'trash'}
          className="w-full text-left"
        >
          <div className="space-y-1 text-xs text-muted">
            <p>{formatDate(meeting.startedAt)}</p>
            {duration > 0 ? <p>{formatDuration(duration)}</p> : <p>녹화 대기 중</p>}
          </div>
        </button>

        {mode === 'trash' ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onRestore}
              className="btn-neo flex-1 px-3 py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              복구
            </button>
            <button
              type="button"
              onClick={onPurge}
              className="btn-neo border-transparent bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              영구삭제
            </button>
          </div>
        ) : null}
      </article>
    );
  },
);

MeetingCard.displayName = 'MeetingCard';
