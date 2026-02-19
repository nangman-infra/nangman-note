'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2, Sparkles } from 'lucide-react';
import { usePrompt } from '../hooks/usePrompt';

interface PromptSelectorProps {
  onChange?: (promptId: string) => void;
}

export function PromptSelector({ onChange }: PromptSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const { prompts, selectedPromptId, setSelectedPrompt } = usePrompt();

  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId);

  const handleChange = (promptId: string) => {
    setSelectedPrompt(promptId);
    onChange?.(promptId);
  };

  return (
    <div className="surface-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-brand" />
          고급 설정: 프롬프트
        </span>
        <span className="text-muted">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      <div className="mt-3 rounded-xl border border-[var(--line-soft)] bg-white p-3">
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted">현재 선택</p>
        <p className="text-sm font-medium">{selectedPrompt?.name || '기본 회의록 프롬프트'}</p>
      </div>

      {expanded && (
        <div className="motion-rise mt-3 space-y-2">
          {prompts.map((prompt) => (
            <label
              key={prompt.id}
              className={`surface-card block cursor-pointer p-3 transition ${
                selectedPromptId === prompt.id ? 'border-[var(--line-strong)] bg-brand/5' : 'hover:border-[var(--line-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="prompt"
                    value={prompt.id}
                    checked={selectedPromptId === prompt.id}
                    onChange={() => handleChange(prompt.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{prompt.name}</span>
                </div>
                {prompt.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
                    <Sparkles className="h-3 w-3" />
                    기본
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">{prompt.content}</p>
            </label>
          ))}

          <button
            type="button"
            className="btn-neo w-full justify-center border-dashed text-xs text-muted"
            aria-label="새 프롬프트 기능은 곧 제공됩니다"
          >
            + 새 프롬프트 만들기 (준비 중)
          </button>
        </div>
      )}
    </div>
  );
}
