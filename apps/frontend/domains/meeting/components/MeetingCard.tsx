'use client';

import { memo } from 'react';
import { AlertTriangle, Check, FileText, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import type { Meeting } from '../types/meeting.types';
import { formatDate, formatDuration } from '@/lib/utils/date';
import {
  getCardSelectionClassName,
  getMeetingStatusConfig,
  getProcessingBannerClassName,
  getProcessingBannerMessage,
} from './meetingCardStatus';

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

    const config = getMeetingStatusConfig(meeting);
    const isRecording = meeting.status === 'recording';
    const cardSelectionClassName = getCardSelectionClassName({
      isSelected,
      isActive,
    });

    const handleCardClick = () => {
      if (selectionMode) {
        onToggleSelect?.();
        return;
      }
      onClick?.();
    };

	    return (
	      <article
	        className={`group relative w-full rounded-xl px-4 py-3 transition-all ${
	          isRecording
	            ? 'border-l-4 border-l-[var(--tertiary)] bg-[var(--surface-container-low)]'
	            : 'bg-[var(--surface-container-low)]'
	        } ${cardSelectionClassName} ${selectionMode ? 'cursor-pointer' : ''}`}
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

          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              isRecording
                ? 'bg-white text-[var(--tertiary)]'
                : 'bg-white/80 text-indigo-600'
            }`}
            aria-hidden="true"
          >
            <FileText className="h-4 w-4" />
          </div>

          {/* Content — inbox-style: title + metadata */}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={selectionMode ? undefined : onClick}
              className={`block w-full text-left ${selectionMode ? 'pointer-events-none' : ''}`}
              disabled={mode === 'trash' || selectionMode}
            >
              <h3 className="line-clamp-1 text-sm font-bold text-slate-900 transition-colors group-hover:text-indigo-700">
                {meeting.title || '제목 없는 회의'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
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
          <div className="flex shrink-0 items-center gap-2">
            {isRecording ? (
              <span className="status-pill status-pill--live">
                {config.label}
              </span>
            ) : (
              <span className={`rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold ${config.colorClass}`}>
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
                className="rounded-full p-2 text-[var(--ink-muted)] opacity-100 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="회의 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {(meeting.status === 'processing' || meeting.needsAttention) && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              getProcessingBannerClassName(meeting.needsAttention)
            }`}
          >
            {meeting.needsAttention ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
	            {getProcessingBannerMessage(meeting)}
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
