'use client';

import { memo } from 'react';
import { AlertTriangle, Check, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
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

/* ── Status text color mapping (no icons, text only) ── */
const statusConfig = {
  recording: {
    label: '진행 중',
    colorClass: 'text-indigo-600',
  },
  processing: {
    label: '정리 중',
    colorClass: 'text-amber-600',
  },
  completed: {
    label: '완료',
    colorClass: 'text-slate-500',
  },
} as const;

const processingPhaseConfig = {
  [MeetingProcessingPhase.UPLOADING]: {
    label: '업로드 중',
    colorClass: 'text-sky-600',
  },
  [MeetingProcessingPhase.TRANSCRIBING]: {
    label: '전사 중',
    colorClass: 'text-amber-600',
  },
  [MeetingProcessingPhase.GENERATING]: {
    label: '정리 중',
    colorClass: 'text-amber-600',
  },
  [MeetingProcessingPhase.REGENERATING]: {
    label: '재생성 중',
    colorClass: 'text-indigo-600',
  },
} as const;

const completionStateConfig = {
  [MeetingCompletionState.SUCCEEDED]: {
    label: '완료',
    colorClass: 'text-slate-500',
  },
  [MeetingCompletionState.PARTIAL]: {
    label: '부분 완료',
    colorClass: 'text-orange-600',
  },
  [MeetingCompletionState.ATTENTION_REQUIRED]: {
    label: '확인 필요',
    colorClass: 'text-rose-600',
  },
  [MeetingCompletionState.FAILED]: {
    label: '실패',
    colorClass: 'text-rose-600',
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
    const completionConfig =
      meeting.status === 'completed' &&
      meeting.completionState &&
      meeting.completionState in completionStateConfig
        ? completionStateConfig[
            meeting.completionState as keyof typeof completionStateConfig
          ]
        : null;
    const config =
      meeting.status === 'processing' && meeting.needsAttention
        ? {
            label: '확인 필요',
            colorClass: 'text-rose-600',
          }
        : meeting.status === 'processing' && phaseConfig
          ? phaseConfig
          : meeting.status === 'completed' && meeting.needsAttention
            ? completionStateConfig[MeetingCompletionState.ATTENTION_REQUIRED]
        : meeting.status === 'completed' && completionConfig
          ? completionConfig
          : baseConfig;

    const isRecording = meeting.status === 'recording';

    const handleCardClick = () => {
      if (selectionMode) {
        onToggleSelect?.();
        return;
      }
      onClick?.();
    };

    return (
      <article
        className={`group relative w-full rounded-xl px-5 py-3.5 transition-all ${
          isRecording
            ? 'border-l-4 border-l-[var(--tertiary)] bg-[var(--surface-container-low)]'
            : 'bg-white'
        } ${
          isSelected
            ? 'bg-indigo-50 shadow-md ring-2 ring-brand/30'
            : isActive
              ? 'bg-white shadow-md'
              : 'hover:bg-[var(--surface-container-high)] hover:shadow-sm'
        } ${selectionMode ? 'cursor-pointer' : ''}`}
        onClick={selectionMode ? handleCardClick : undefined}
      >
        <div className="flex items-center gap-3">
          {/* Selection checkbox */}
          {selectionMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                isSelected
                  ? 'border-brand bg-brand text-white'
                  : 'border-[var(--outline-variant)] bg-white hover:border-brand'
              }`}
              aria-label={isSelected ? '선택 해제' : '선택'}
            >
              {isSelected ? <Check className="h-3 w-3" /> : null}
            </button>
          ) : null}

          {/* Content — compact: title + date/time inline */}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={selectionMode ? undefined : onClick}
              className={`block w-full text-left ${selectionMode ? 'pointer-events-none' : ''}`}
              disabled={mode === 'trash' || selectionMode}
            >
              <h3 className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                {meeting.title || '제목 없는 회의'}
              </h3>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <span>{formatDate(meeting.startedAt)}</span>
                {duration > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{formatDuration(duration)}</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Right side: status text + actions */}
          <div className="flex items-center gap-3 shrink-0">
            {isRecording ? (
              <span className="status-pill status-pill--live">
                {config.label}
              </span>
            ) : (
              <span className={`text-xs font-semibold ${config.colorClass}`}>
                {config.label}
              </span>
            )}

            {meeting.status === 'completed' &&
            meeting.processingPhase === MeetingProcessingPhase.REGENERATING ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                재생성 중
              </span>
            ) : null}

            {mode === 'active' && onDelete && !selectionMode ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded-full p-2 text-[var(--ink-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                aria-label="회의 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Processing status banner */}
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

        {/* Trash mode actions */}
        {mode === 'trash' && !selectionMode ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRestore}
              className="btn-secondary inline-flex justify-center px-2 py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">복구</span>
            </button>
            <button
              type="button"
              onClick={onPurge}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
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
