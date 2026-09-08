'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Edit3, Save, X } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import type { MeetingResult } from '../types/result.types';
import { ResultExportMenu } from './ResultExportMenu';
import { RESULT_SPEAKER_PALETTE, getSpeakerInitial } from './resultViewerHelpers';

interface ResultViewerHeaderProps {
  result: MeetingResult;
  isEditing: boolean;
  isEditingTitle: boolean;
  editTitle: string;
  isRegenerating: boolean;
  error?: string | null;
  isExporting: 'pdf' | 'docx' | 'md' | null;
  uniqueSpeakers: string[];
  visibleSpeakers: string[];
  overflowSpeakerCount: number;
  onTitleClick: () => void;
  onTitleChange: (title: string) => void;
  onTitleSave: () => void;
  onTitleCancel: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onCopy: () => void;
  onExportPDF: () => void;
  onExportDOCX: () => void;
  onExportMD: () => void;
}

export function ResultViewerHeader({
  result,
  isEditing,
  isEditingTitle,
  editTitle,
  isRegenerating,
  error,
  isExporting,
  uniqueSpeakers,
  visibleSpeakers,
  overflowSpeakerCount,
  onTitleClick,
  onTitleChange,
  onTitleSave,
  onTitleCancel,
  onStartEdit,
  onCancelEdit,
  onSave,
  onCopy,
  onExportPDF,
  onExportDOCX,
  onExportMD,
}: ResultViewerHeaderProps) {
  const [showSpeakerPopover, setShowSpeakerPopover] = useState(false);
  const speakerPopoverRef = useRef<HTMLDivElement>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingTitleRef = useRef(false);
  const cancelTitleBlurRef = useRef(false);

  useEffect(() => {
    if (wasEditingTitleRef.current && !isEditingTitle) {
      titleButtonRef.current?.focus();
    }
    wasEditingTitleRef.current = isEditingTitle;
  }, [isEditingTitle]);

  useEffect(() => {
    if (!showSpeakerPopover) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        speakerPopoverRef.current &&
        !speakerPopoverRef.current.contains(event.target as Node)
      ) {
        setShowSpeakerPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeakerPopover]);

  return (
    <header className="mx-auto w-full max-w-[880px] px-6 pb-2 pt-8 sm:px-8 lg:px-10">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="tag-dot">
          {result.metadata?.totalDuration > 0 ? 'AI minutes' : 'Note-based minutes'}
        </span>
        <span className="data-mono text-xs text-[var(--ink-muted)]">
          {new Date(result.createdAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}
          {Math.round(result.metadata.totalDuration / 60)}분
        </span>
      </div>

      {isEditingTitle ? (
        <input
          autoFocus
          aria-label="회의 제목"
          value={editTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={() => {
            if (cancelTitleBlurRef.current) {
              cancelTitleBlurRef.current = false;
              return;
            }
            onTitleSave();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onTitleSave();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelTitleBlurRef.current = true;
              onTitleCancel();
            }
          }}
          className="input-shell font-headline !text-[28px] leading-[1.1] sm:!text-[34px] lg:!text-[40px]"
        />
      ) : (
        <h1 className="font-headline text-[28px] leading-[1.1] text-[var(--ink-strong)] sm:text-[34px] lg:text-[40px]">
          <button
            ref={titleButtonRef}
            type="button"
            onClick={onTitleClick}
            className="rounded text-left transition hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            aria-label={`${result.metadata?.title || '회의록'} 제목 편집`}
            title="제목 편집"
          >
            {result.metadata?.title || '회의록'}
          </button>
        </h1>
      )}

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="label-sm">Transcript words</dt>
          <dd className="data-mono mt-0.5 text-lg font-medium text-seafoam-deep">
            {result.metadata.transcriptWordCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="label-sm">Note length</dt>
          <dd className="data-mono mt-0.5 text-lg font-medium text-seafoam-deep">
            {result.metadata.noteLength.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="label-sm">Duration</dt>
          <dd className="data-mono mt-0.5 text-lg font-medium text-seafoam-deep">
            {Math.round(result.metadata.totalDuration / 60)}m
          </dd>
        </div>
      </dl>

      {uniqueSpeakers.length > 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2" aria-label={`참가자 ${uniqueSpeakers.length}명`}>
            {visibleSpeakers.map((label, index) => (
              <span
                key={label}
                title={label}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-medium text-white ring-2 ring-white ${
                  RESULT_SPEAKER_PALETTE[index % RESULT_SPEAKER_PALETTE.length]
                }`}
              >
                {getSpeakerInitial(label)}
              </span>
            ))}
            {overflowSpeakerCount > 0 ? (
              <div ref={speakerPopoverRef} className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setShowSpeakerPopover((value) => !value)}
                  aria-label={`추가 참가자 ${overflowSpeakerCount}명 보기`}
                  aria-expanded={showSpeakerPopover}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-container)] text-[10px] font-medium text-[var(--ink-subtle)] ring-2 ring-white transition hover:bg-[var(--surface-container-high)]"
                >
                  +{overflowSpeakerCount}
                </button>
                {showSpeakerPopover ? (
                  <div className="surface-card absolute left-0 top-full z-20 mt-1 min-w-[160px] p-2 !shadow-[var(--elevation-md)]">
                    <p className="label-sm mb-1">Participants</p>
                    <ul className="space-y-1">
                      {uniqueSpeakers.map((label, index) => (
                        <li key={label} className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium text-white ${
                              RESULT_SPEAKER_PALETTE[
                                index % RESULT_SPEAKER_PALETTE.length
                              ]
                            }`}
                          >
                            {getSpeakerInitial(label)}
                          </span>
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="text-xs font-medium text-[var(--ink-muted)]">
            참가자 {uniqueSpeakers.length}명
          </span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {!isEditing ? (
          <>
            <ResultExportMenu
              isExporting={isExporting}
              onExportPDF={onExportPDF}
              onExportDOCX={onExportDOCX}
              onExportMD={onExportMD}
            />
            <button type="button" onClick={onStartEdit} className="btn-neo inline-flex">
              <Edit3 className="h-4 w-4" strokeWidth={1.75} />
              편집
            </button>
            <button type="button" onClick={onCopy} className="btn-neo inline-flex">
              <Copy className="h-4 w-4" strokeWidth={1.75} />
              복사
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onCancelEdit} className="btn-neo inline-flex">
              <X className="h-4 w-4" strokeWidth={1.75} />
              취소
            </button>
            <button type="button" onClick={onSave} className="btn-primary inline-flex">
              <Save className="h-4 w-4" />
              저장
            </button>
          </>
        )}
      </div>

      {renderResultStatusBanner({ isRegenerating, error })}
    </header>
  );
}

function renderResultStatusBanner({
  isRegenerating,
  error,
}: {
  isRegenerating: boolean;
  error?: string | null;
}) {
  if (isRegenerating) {
    return (
      <StatusBanner
        variant="info"
        title="AI가 회의록을 재생성하고 있습니다"
        message="프롬프트를 변경하여 새로운 회의록을 생성 중입니다. 완료되면 자동으로 업데이트됩니다."
        className="mb-3"
      />
    );
  }

  if (error) {
    return (
      <StatusBanner
        variant="error"
        title="결과 처리 오류"
        message="잠시 후 다시 시도해주세요. 입력하신 내용은 유지됩니다."
        className="mb-3"
      />
    );
  }

  return null;
}
