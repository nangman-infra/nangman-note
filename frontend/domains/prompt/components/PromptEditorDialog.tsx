'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface PromptEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialContent?: string;
  isLoading?: boolean;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
}

export function PromptEditorDialog({
  open,
  mode,
  initialName = '',
  initialContent = '',
  isLoading = false,
  onSave,
  onCancel,
}: PromptEditorDialogProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);

  if (!open) return null;

  const isValid = name.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSave(name.trim(), content.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="surface-card w-full max-w-lg space-y-4 p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? '새 프롬프트 만들기' : '프롬프트 편집'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-full p-1 text-muted transition hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label htmlFor="prompt-name" className="mb-1 block text-xs font-semibold text-muted">
            프롬프트 이름
          </label>
          <input
            id="prompt-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 일일 스탠드업"
            className="input-shell w-full"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="prompt-content" className="mb-1 block text-xs font-semibold text-muted">
            프롬프트 내용
          </label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'# ROLE\n당신은...'}
            rows={10}
            className="input-shell w-full resize-y font-mono text-sm"
            disabled={isLoading}
          />
          <p className="mt-1 text-[11px] text-muted">
            AI가 회의록을 생성할 때 사용할 지시사항을 작성하세요.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-neo px-4 py-2 text-xs"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="btn-neo border-transparent bg-brand px-4 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? '저장 중...' : mode === 'create' ? '생성' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
