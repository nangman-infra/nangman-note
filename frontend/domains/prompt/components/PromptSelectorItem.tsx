'use client';

import { Edit3, Sparkles, Trash2 } from 'lucide-react';
import {
  PROMPT_DOCUMENT_TYPE_LABELS,
  type Prompt,
} from '../types/prompt.types';

interface PromptSelectorItemProps {
  prompt: Prompt;
  isSelected: boolean;
  deleteConfirmId: string | null;
  onChange: (promptId: string) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
  onRequestDeleteConfirm: (promptId: string) => void;
}

export function PromptSelectorItem({
  prompt,
  isSelected,
  deleteConfirmId,
  onChange,
  onEdit,
  onDelete,
  onRequestDeleteConfirm,
}: PromptSelectorItemProps) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => onChange(prompt.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(prompt.id);
          }
        }}
        className={`block w-full cursor-pointer rounded-lg p-3 text-left transition ${getPromptItemClassName(
          isSelected,
        )}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <PromptSelectionIndicator isSelected={isSelected} />
            <span
              className={`text-sm font-medium ${getPromptNameClassName(
                isSelected,
              )}`}
            >
              {prompt.name}
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
              {PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {renderPromptActions({
              prompt,
              deleteConfirmId,
              onEdit,
              onDelete,
              onRequestDeleteConfirm,
            })}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-[var(--ink-muted)]">
          {prompt.content}
        </p>
      </div>
    </li>
  );
}

function PromptSelectionIndicator({ isSelected }: { isSelected: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition ${
        isSelected ? 'bg-[var(--brand)]' : 'bg-[var(--surface-container-high)]'
      }`}
      aria-hidden="true"
    >
      {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

function renderPromptActions({
  prompt,
  deleteConfirmId,
  onEdit,
  onDelete,
  onRequestDeleteConfirm,
}: {
  prompt: Prompt;
  deleteConfirmId: string | null;
  onEdit: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
  onRequestDeleteConfirm: (promptId: string) => void;
}) {
  if (prompt.isDefault) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]">
        <Sparkles className="h-3 w-3" />
        기본
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(prompt);
        }}
        className="rounded-full p-1 text-[var(--ink-muted)] transition hover:bg-black/5 hover:text-[var(--ink-strong)]"
        aria-label="편집"
      >
        <Edit3 className="h-3 w-3" />
      </button>
      <PromptDeleteButton
        isConfirming={deleteConfirmId === prompt.id}
        promptId={prompt.id}
        onDelete={onDelete}
        onRequestDeleteConfirm={onRequestDeleteConfirm}
      />
    </>
  );
}

function PromptDeleteButton({
  isConfirming,
  promptId,
  onDelete,
  onRequestDeleteConfirm,
}: {
  isConfirming: boolean;
  promptId: string;
  onDelete: (promptId: string) => void;
  onRequestDeleteConfirm: (promptId: string) => void;
}) {
  if (isConfirming) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(promptId);
        }}
        className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"
      >
        삭제 확인
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRequestDeleteConfirm(promptId);
      }}
      className="rounded-full p-1 text-[var(--ink-muted)] transition hover:bg-rose-50 hover:text-rose-600"
      aria-label="삭제"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

function getPromptItemClassName(isSelected: boolean): string {
  if (isSelected) {
    return 'bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]';
  }

  return 'bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)]';
}

function getPromptNameClassName(isSelected: boolean): string {
  if (isSelected) return 'text-[var(--brand)]';
  return 'text-[var(--ink-strong)]';
}
