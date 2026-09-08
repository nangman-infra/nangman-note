'use client';

import { useRef, type KeyboardEvent } from 'react';

import type { ResultTab } from './resultViewerTypes';

interface ResultTabNavProps {
  activeTab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
}

const RESULT_TABS: Array<{ key: ResultTab; label: string }> = [
  { key: 'result', label: 'AI 회의록' },
  { key: 'transcript', label: '전체 전사' },
  { key: 'note', label: '원본 노트' },
];

export function ResultTabNav({ activeTab, onTabChange }: ResultTabNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % RESULT_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + RESULT_TABS.length) % RESULT_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = RESULT_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onTabChange(RESULT_TABS[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--line-soft)] bg-[var(--bg-elevated)] backdrop-blur-xl">
      <div role="tablist" aria-label="회의 문서 보기" className="mx-auto flex w-full max-w-[880px] gap-6 px-6 sm:px-8 lg:px-10">
        {RESULT_TABS.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`result-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls="result-tabpanel"
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`relative -mb-px py-3.5 text-sm transition ${
              activeTab === tab.key
                ? 'text-[var(--ink-strong)] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-electric-gradient after:content-[\'\']'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
