'use client';

import { memo } from 'react';
import { AlertTriangle, Check, Clock3, Hourglass, Loader2, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
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
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
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

const processingPhaseConfig = {
  [MeetingProcessingPhase.UPLOADING]: {
    label: '업로드 중',
    className: 'bg-sky-100 text-sky-700',
    icon: Upload,
  },
  [MeetingProcessingPhase.TRANSCRIBING]: {
    label: '전사 중',
    className: 'bg-amber-100 text-amber-700',
    icon: Hourglass,
  },
  [MeetingProcessingPhase.GENERATING]: {
    label: '정리 중',
    className: 'bg-amber-100 text-amber-700',
    icon: Hourglass,
  },
  [MeetingProcessingPhase.REGENERATING]: {
    label: '재생성 중',
    className: 'bg-brand/10 text-brand',
    icon: Loader2,
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
    selectionMode = false,
    isSelected = false,
    onToggleSelect,
  }: MeetingCardProps) => {
    const duration = meeting.endedAt
      ? (new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000
      : 0;

    const baseConfig = statusConfig[meeting.status];
    const phaseConfig =
      meeting.processingPhase &&
      meeting.processingPhase in processingPhaseConfig
        ? processingPhaseConfig[
            meeting.processingPhase as keyof typeof processingPhaseConfig
          ]
        : null;
    const config = meeting.needsAttention
      ? {
          label: '확인 필요',
          className: 'bg-rose-100 text-rose-700',
          icon: AlertTriangle,
        }
      : meeting.status === 'processing' && phaseConfig
        ? phaseConfig
        : baseConfig;
    const StatusIcon = config.icon;

    const handleCardClick = () => {
      if (selectionMode) {
        onToggleSelect?.();
        return;
      }
      onClick?.();
    };

    return (
      <article
        className={`surface-card w-full p-4 transition ${
          isSelected
            ? 'border-brand bg-brand/5 shadow-[0_8px_20px_rgba(17,94,89,0.10)]'
            : isActive
              ? 'border-[var(--line-strong)] bg-white shadow-[0_16px_30px_rgba(17,94,89,0.12)]'
              : 'hover:-translate-y-0.5 hover:border-[var(--line-strong)]'
        } ${selectionMode ? 'cursor-pointer' : ''}`}
        onClick={selectionMode ? handleCardClick : undefined}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          {selectionMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                isSelected
                  ? 'border-brand bg-brand text-white'
                  : 'border-[var(--line-strong)] bg-white hover:border-brand'
              }`}
              aria-label={isSelected ? '선택 해제' : '선택'}
            >
              {isSelected ? <Check className="h-3 w-3" /> : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={selectionMode ? undefined : onClick}
            className={`min-w-0 flex-1 text-left ${selectionMode ? 'pointer-events-none' : ''}`}
            disabled={mode === 'trash' || selectionMode}
          >
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
              {meeting.title || '제목 없는 회의'}
            </h3>
          </button>

          <div className="flex items-center gap-1.5">
            {mode === 'active' && onDelete && !selectionMode ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded-full p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-700"
                aria-label="회의 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span className={`status-pill inline-flex items-center gap-1 ${config.className}`}>
              <StatusIcon
                className={`h-3 w-3 ${
                  meeting.processingPhase === MeetingProcessingPhase.REGENERATING
                    ? 'animate-spin'
                    : ''
                }`}
              />
              {config.label}
            </span>
            {meeting.status === 'completed' &&
            meeting.processingPhase === MeetingProcessingPhase.REGENERATING ? (
              <span className="status-pill inline-flex items-center gap-1 bg-brand/10 text-brand">
                <Loader2 className="h-3 w-3 animate-spin" />
                재생성 중
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={selectionMode ? undefined : onClick}
          disabled={mode === 'trash' || selectionMode}
          className={`w-full text-left ${selectionMode ? 'pointer-events-none' : ''}`}
        >
          <div className="space-y-1 text-xs text-muted">
            <p>{formatDate(meeting.startedAt)}</p>
            {duration > 0 ? <p>{formatDuration(duration)}</p> : <p>녹화 대기 중</p>}
          </div>
        </button>

        {(meeting.status === 'processing' || meeting.needsAttention) && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              meeting.needsAttention
                ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {meeting.needsAttention ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {meeting.needsAttention
              ? '확인이 필요한 처리 이슈가 있습니다.'
              : meeting.processingPhase === MeetingProcessingPhase.UPLOADING
                ? '오디오 업로드 중...'
                : meeting.processingPhase === MeetingProcessingPhase.TRANSCRIBING
                  ? '전사 처리 중...'
                  : '회의록 생성 중...'}
          </div>
        )}

        {mode === 'trash' && !selectionMode ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRestore}
              className="btn-neo inline-flex justify-center px-2 py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">복구</span>
            </button>
            <button
              type="button"
              onClick={onPurge}
              className="btn-neo inline-flex justify-center border-transparent bg-rose-600 px-2 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">영구삭제</span>
            </button>
          </div>
        ) : null}
      </article>
    );
  },
);

MeetingCard.displayName = 'MeetingCard';
