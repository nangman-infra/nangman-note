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
      {/* 헤더 + 현재 선택 영역 전체가 클릭 가능 */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-brand" />
            프롬프트 설정
          </span>
          <span className="text-muted">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--line-soft)] bg-white p-3 transition hover:border-[var(--line-strong)]">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted">현재 선택</p>
          <p className="text-sm font-medium">{selectedPrompt?.name || '기본 회의록 프롬프트'}</p>
        </div>
      </button>

      {expanded && (
        <div className="motion-rise mt-3 space-y-2">
          {prompts.map((prompt) => {
            const isSelected = selectedPromptId === prompt.id;
            return (
              <button
                key={prompt.id}
                type="button"
                onClick={() => handleChange(prompt.id)}
                className={`surface-card block w-full cursor-pointer p-3 text-left transition ${
                  isSelected ? 'border-[var(--line-strong)] bg-brand/5' : 'hover:border-[var(--line-strong)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? 'border-brand bg-brand' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
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
              </button>
            );
          })}

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