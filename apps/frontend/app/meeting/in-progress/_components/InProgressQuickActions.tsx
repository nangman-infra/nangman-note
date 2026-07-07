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
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onSaveNote}
        aria-label="노트 저장"
        title="노트 저장"
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition hover:bg-slate-50 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tertiary)]"
      >
        <Save className="h-6 w-6 text-[var(--tertiary)]" aria-hidden="true" />
      </button>
    </div>
  );
}
