'use client';

import { Save, Sparkles } from 'lucide-react';

interface InProgressQuickActionsProps {
  onShowSummaryInfo: () => void;
  onSaveNote: () => void;
}

export function InProgressQuickActions({
  onShowSummaryInfo,
  onSaveNote,
}: InProgressQuickActionsProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8"
      aria-label="빠른 작업"
    >
      <button
        type="button"
        onClick={onShowSummaryInfo}
        aria-label="AI 요약 안내"
        title="AI 요약 안내"
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-electric-gradient text-white shadow-[var(--elevation-button)] transition hover:brightness-110 active:scale-95"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        onClick={onSaveNote}
        aria-label="노트 저장"
        title="노트 저장"
        className="glass-surface pointer-events-auto inline-flex h-12 w-12 items-center justify-center !rounded-[12px] text-[var(--ink-strong)] transition hover:bg-[var(--surface-container)] active:scale-95"
      >
        <Save className="h-5 w-5 text-[var(--tertiary)]" aria-hidden="true" strokeWidth={1.75} />
      </button>
    </div>
  );
}
