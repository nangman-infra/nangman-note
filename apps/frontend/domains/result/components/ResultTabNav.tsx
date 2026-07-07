'use client';

import type { ResultTab } from './resultViewerTypes';

interface ResultTabNavProps {
  activeTab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
}

const RESULT_TABS: Array<{ key: ResultTab; label: string }> = [
  { key: 'result', label: 'AI Summary' },
  { key: 'transcript', label: 'Full Transcript' },
  { key: 'note', label: 'Original Notes' },
];

export function ResultTabNav({ activeTab, onTabChange }: ResultTabNavProps) {
  return (
    <div className="px-6 sm:px-8 lg:px-12">
      <div className="flex gap-8 border-b border-[var(--outline-variant)]/10">
        {RESULT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`pb-4 text-sm font-bold tracking-wide transition ${
              activeTab === tab.key
                ? 'border-b-2 border-brand text-slate-900'
                : 'border-b-2 border-transparent text-[var(--ink-muted)] hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
