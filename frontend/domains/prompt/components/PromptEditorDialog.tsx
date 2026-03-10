'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  PROMPT_DOCUMENT_TYPE_LABELS,
  type PromptDocumentType,
} from '../types/prompt.types';

const PROMPT_CONTENT_MAX_LENGTH = 12_000;
const PROMPT_NAME_MAX_LENGTH = 100;

interface PromptEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialContent?: string;
  initialDocumentType?: PromptDocumentType;
  isLoading?: boolean;
  onSave: (
    name: string,
    content: string,
    documentType: PromptDocumentType,
  ) => void;
  onCancel: () => void;
}

export function PromptEditorDialog({
  open,
  mode,
  initialName = '',
  initialContent = '',
  initialDocumentType = 'meeting',
  isLoading = false,
  onSave,
  onCancel,
}: PromptEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [documentType, setDocumentType] =
    useState<PromptDocumentType>(initialDocumentType);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  // Handle native dialog close (ESC key) by calling onCancel
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (open) {
        onCancel();
      }
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [open, onCancel]);

  const isValid = name.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSave(name.trim(), content.trim(), documentType);
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-lg rounded-xl bg-transparent p-0 backdrop:bg-black/30"
    >
      <form
        onSubmit={handleSubmit}
        className="surface-card w-full space-y-4 p-5 shadow-xl"
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
            maxLength={PROMPT_NAME_MAX_LENGTH}
            placeholder="예: 일일 스탠드업"
            className="input-shell w-full"
            disabled={isLoading}
            autoFocus
          />
          <div className="mt-1 flex justify-end">
            <p
              className={`text-[11px] tabular-nums ${
                name.length > PROMPT_NAME_MAX_LENGTH * 0.9
                  ? 'text-rose-500'
                  : 'text-muted'
              }`}
            >
              {name.length.toLocaleString()}/{PROMPT_NAME_MAX_LENGTH.toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="prompt-document-type" className="mb-1 block text-xs font-semibold text-muted">
            기본 문서 타입
          </label>
          <select
            id="prompt-document-type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as PromptDocumentType)}
            className="input-shell w-full"
            disabled={isLoading}
          >
            {Object.entries(PROMPT_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">
            {PROMPT_DOCUMENT_TYPE_HELP_TEXT[documentType]}
          </p>
        </div>

        <div>
          <label htmlFor="prompt-content" className="mb-1 block text-xs font-semibold text-muted">
            추가 강조 지시
          </label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={PROMPT_CONTENT_MAX_LENGTH}
            placeholder="예: 실무 팁과 후속 과제를 더 분명하게 정리해줘"
            rows={10}
            className="input-shell w-full resize-y font-mono text-sm"
            disabled={isLoading}
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[11px] text-muted">
              기본 타입의 구조는 유지하고, 이 프롬프트는 강조점과 표현 방식만 추가합니다.
            </p>
            <p
              className={`text-[11px] tabular-nums ${
                content.length > PROMPT_CONTENT_MAX_LENGTH * 0.9
                  ? 'text-rose-500'
                  : 'text-muted'
              }`}
            >
              {content.length.toLocaleString()}/{PROMPT_CONTENT_MAX_LENGTH.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-neo inline-flex px-4 py-2 text-xs"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="btn-neo inline-flex border-transparent bg-brand px-4 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? '저장 중...' : mode === 'create' ? '생성' : '저장'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
