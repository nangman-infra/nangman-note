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
    <header className="px-6 py-6 sm:px-8 lg:px-12">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-[var(--tertiary-fixed)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--tertiary)]">
          {result.metadata?.totalDuration > 0 ? 'Finished' : 'Note based'}
        </span>
        <span className="text-sm font-medium text-[var(--ink-muted)]">
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
          value={editTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={onTitleSave}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              onTitleSave();
            }
            if (event.key === 'Escape') {
              onTitleCancel();
            }
          }}
          className="input-shell font-headline text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
        />
      ) : (
        <h1
          onClick={onTitleClick}
          className="font-headline text-3xl font-extrabold leading-tight tracking-tight cursor-pointer hover:text-indigo-700 transition sm:text-4xl lg:text-5xl"
          title="클릭하여 제목 편집"
        >
          {result.metadata?.title || '회의록'}
        </h1>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 font-semibold text-[var(--on-secondary-container)]">
          단어 수: {result.metadata.transcriptWordCount}
        </span>
        <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 font-semibold text-[var(--on-secondary-container)]">
          노트 길이: {result.metadata.noteLength}
        </span>
      </div>

      {uniqueSpeakers.length > 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2" aria-label={`참가자 ${uniqueSpeakers.length}명`}>
            {visibleSpeakers.map((label, index) => (
              <span
                key={label}
                title={label}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 ring-2 ring-white hover:bg-slate-300 transition"
                >
                  +{overflowSpeakerCount}
                </button>
                {showSpeakerPopover ? (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg bg-white p-2 shadow-lg">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      전체 참가자
                    </p>
                    <ul className="space-y-1">
                      {uniqueSpeakers.map((label, index) => (
                        <li key={label} className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isEditing ? (
          <>
            <ResultExportMenu
              isExporting={isExporting}
              onExportPDF={onExportPDF}
              onExportDOCX={onExportDOCX}
              onExportMD={onExportMD}
            />
            <button type="button" onClick={onStartEdit} className="btn-secondary inline-flex">
              <Edit3 className="h-4 w-4" />
              편집
            </button>
            <button type="button" onClick={onCopy} className="btn-secondary inline-flex">
              <Copy className="h-4 w-4" />
              복사
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onCancelEdit} className="btn-secondary inline-flex">
              <X className="h-4 w-4" />
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
