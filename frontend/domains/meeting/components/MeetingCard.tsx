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
        className={`group relative w-full rounded-lg border px-4 py-3 transition-all ${
          isRecording
            ? 'border-[var(--line-soft)] bg-white shadow-[inset_3px_0_0_0_var(--tertiary)]'
            : 'border-[var(--line-soft)] bg-white'
        } ${cardSelectionClassName} ${selectionMode ? 'cursor-pointer' : ''}`}
        onClick={selectionMode ? handleCardClick : undefined}
        onKeyDown={selectionMode ? (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onToggleSelect?.();
        } : undefined}
        role={selectionMode ? 'checkbox' : undefined}
        aria-checked={selectionMode ? isSelected : undefined}
        aria-label={selectionMode ? `${meeting.title || '제목 없는 회의'} ${isSelected ? '선택됨' : '선택 안 됨'}` : undefined}
        tabIndex={selectionMode ? 0 : undefined}
      >
        <div className="flex items-center gap-3">
          {/* Selection checkbox */}
          {selectionMode ? (
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition ${
                isSelected
                  ? 'border-brand bg-brand text-white'
                  : 'border-[var(--line-strong)] bg-white hover:border-brand'
              }`}
              aria-hidden="true"
            >
              {isSelected ? <Check className="h-3 w-3" /> : null}
            </span>
          ) : null}

          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line-soft)] transition ${
              isRecording
                ? 'bg-[var(--tertiary-fixed)] text-[var(--tertiary)]'
                : 'bg-[var(--surface-container-low)] text-[var(--ink-muted)] group-hover:text-brand'
            }`}
            aria-hidden="true"
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          </div>

          {/* Content — inbox-style: title + metadata */}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={selectionMode ? undefined : onClick}
              className={`block w-full text-left ${selectionMode ? 'pointer-events-none' : ''}`}
              disabled={mode === 'trash' || selectionMode}
              aria-current={isActive ? 'true' : undefined}
            >
              <h3 className="line-clamp-1 text-sm font-medium text-[var(--ink-strong)] transition-colors group-hover:text-brand">
                {meeting.title || '제목 없는 회의'}
              </h3>
              {meeting.searchSnippet && meeting.searchMatchedIn ? (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-muted)]">
                  <span className="label-sm mr-1.5 inline-flex items-center rounded-[4px] bg-[var(--brand-fixed)] px-1.5 py-0.5 !text-[10px] !text-brand">
                    {getSearchMatchLabel(meeting.searchMatchedIn)}
                  </span>
                  {meeting.searchSnippet}
                </p>
              ) : null}
              <div className="data-mono mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                <span>{formatDate(meeting.startedAt)}</span>
                {duration > 0 && (
                  <>
                    <span className="text-[var(--ink-hairline)]">·</span>
                    <span>{formatDuration(duration)}</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Right side: status text + actions */}
          <div className="flex shrink-0 items-center gap-2">
            {isRecording ? (
              <span className="status-pill status-pill--live" role="status">
                {config.label}
              </span>
            ) : (
              <span className={`status-pill status-pill--idle ${config.colorClass}`}>
                {config.label}
              </span>
            )}

            {meeting.status === 'completed' &&
            meeting.processingPhase === MeetingProcessingPhase.REGENERATING ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                <Loader2 className="h-3 w-3 animate-spin" />
                재생성 중
              </span>
            ) : null}

            {mode === 'active' && onDelete && !selectionMode ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="btn-icon inline-flex opacity-100 hover:!bg-[var(--danger-soft)] hover:!text-[var(--danger)] focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="회의 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {(meeting.status === 'processing' || meeting.needsAttention) && (
          <div
            role={meeting.needsAttention ? 'alert' : 'status'}
            aria-live={meeting.needsAttention ? 'assertive' : 'polite'}
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
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
              className="btn-secondary inline-flex justify-center !px-2 !py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">복구</span>
            </button>
            <button
              type="button"
              onClick={onPurge}
              className="btn-danger inline-flex !px-2 !py-1.5 text-xs"
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

function getSearchMatchLabel(
  matchedIn: NonNullable<Meeting['searchMatchedIn']>,
): string {
  switch (matchedIn) {
    case 'title':
      return '제목';
    case 'note':
      return '노트';
    case 'transcript':
      return '전사';
    case 'result':
      return '회의록';
  }
}
