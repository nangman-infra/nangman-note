'use client';

import { RefreshCw } from 'lucide-react';
import { PROMPT_DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import type { ResultPromptOption } from './resultViewerTypes';

interface ResultRegeneratePanelProps {
  isOpen: boolean;
  isRegenerating: boolean;
  promptOptions: ResultPromptOption[];
  currentPromptId?: string;
  regeneratePromptId: string;
  resolvedRegeneratePromptId: string;
  onOpen: () => void;
  onCancel: () => void;
  onPromptChange: (promptId: string) => void;
  onRegenerateClick: () => void;
}

export function ResultRegeneratePanel({
  isOpen,
  isRegenerating,
  promptOptions,
  currentPromptId,
  regeneratePromptId,
  resolvedRegeneratePromptId,
  onOpen,
  onCancel,
  onPromptChange,
  onRegenerateClick,
}: ResultRegeneratePanelProps) {
  const selectedRegeneratePrompt = promptOptions.find(
    (prompt) => prompt.id === resolvedRegeneratePromptId,
  );

  if (!isOpen) {
    return (
      <button type="button" onClick={onOpen} className="btn-secondary inline-flex">
        <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
        프롬프트 변경 후 재생성
      </button>
    );
  }

  return (
    <div className="surface-card flex flex-col gap-3 p-3">
      {promptOptions.length > 0 ? (
        <select
          value={resolvedRegeneratePromptId}
          onChange={(event) => onPromptChange(event.target.value)}
          className="input-shell"
        >
          {[...promptOptions]
            .sort((a, b) => {
              if (a.id === currentPromptId && b.id !== currentPromptId) return -1;
              if (b.id === currentPromptId && a.id !== currentPromptId) return 1;
              return 0;
            })
            .map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.label}
              </option>
            ))}
        </select>
      ) : (
        <input
          type="text"
          value={regeneratePromptId}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="예: prompt_default_meeting"
          className="input-shell"
        />
      )}
      {selectedRegeneratePrompt ? (
        <p className="text-[11px] text-muted">
          기본 타입은{' '}
          {PROMPT_DOCUMENT_TYPE_LABELS[selectedRegeneratePrompt.documentType]}
          {' '}구조를 사용하고, 사용자 프롬프트는 추가 강조만 반영합니다.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-neo inline-flex whitespace-nowrap px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onRegenerateClick}
          disabled={isRegenerating || !resolvedRegeneratePromptId.trim()}
          className="btn-neo inline-flex whitespace-nowrap border-transparent bg-brand px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isRegenerating ? '재생성 중...' : '재생성 실행'}
        </button>
      </div>
    </div>
  );
}
