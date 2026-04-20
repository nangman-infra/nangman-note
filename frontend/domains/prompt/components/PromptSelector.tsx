'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { usePrompt } from '../hooks/usePrompt';
import { PromptEditorDialog } from './PromptEditorDialog';
import {
  PROMPT_DOCUMENT_TYPE_LABELS,
  type PromptDocumentType,
} from '../types/prompt.types';

interface PromptSelectorProps {
  selectedPromptId?: string;
  onDefaultPromptChange?: (promptId: string) => boolean | Promise<boolean>;
  onChange?: (promptId: string) => void;
}

/* ─────────────────────────────────────────────────────────────
   PromptSelector — Stitch "Cognitive Workspace" tone.

   Design rules applied:
   - FR-9 (No-Line): borders replaced with tonal surface hierarchy
     (bg-[var(--surface-container-low)] → high on hover / selected).
   - FR-10: buttons use `rounded-lg` (8px), chips use `rounded-full`,
     outer card stays at `surface-card` (12px).
   - Transitions are smooth (`transition`) so tonal state changes
     feel like Stitch's "felt, not seen" surface lift.
   - All functional contracts (onChange, selection state, open/close,
     CRUD handlers, a11y roles) are preserved from the prior design.
   ───────────────────────────────────────────────────────────── */
export function PromptSelector({
  selectedPromptId: selectedPromptIdProp,
  onDefaultPromptChange,
  onChange,
}: PromptSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const { prompts, isLoading, createPrompt, updatePrompt, deletePrompt } =
    usePrompt();

  const selectedPromptId = prompts.some((prompt) => prompt.id === selectedPromptIdProp)
    ? selectedPromptIdProp
    : DEFAULT_PROMPT_ID;
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editorInitialName, setEditorInitialName] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState('');
  const [editorInitialDocumentType, setEditorInitialDocumentType] =
    useState<PromptDocumentType>('meeting');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleChange = async (promptId: string) => {
    const success = await onDefaultPromptChange?.(promptId);
    if (success === false) return;
    onChange?.(promptId);
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditingPromptId(null);
    setEditorInitialName('');
    setEditorInitialContent('');
    setEditorInitialDocumentType('meeting');
    setEditorOpen(true);
  };

  const openEdit = (prompt: {
    id: string;
    name: string;
    content: string;
    documentType: PromptDocumentType;
  }) => {
    setEditorMode('edit');
    setEditingPromptId(prompt.id);
    setEditorInitialName(prompt.name);
    setEditorInitialContent(prompt.content);
    setEditorInitialDocumentType(prompt.documentType);
    setEditorOpen(true);
  };

  const handleSave = async (
    name: string,
    content: string,
    documentType: PromptDocumentType,
  ) => {
    setIsSaving(true);
    try {
      if (editorMode === 'create') {
        await createPrompt({ name, content, documentType });
      } else if (editingPromptId) {
        await updatePrompt(editingPromptId, { name, content, documentType });
      }
      setEditorOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    await deletePrompt(id);
    if (selectedPromptId === id) {
      const fallback = prompts.find((prompt) => prompt.id !== id && prompt.isDefault);
      if (fallback) {
        void handleChange(fallback.id);
      }
    }
  };

  return (
    <div className="surface-card p-4">
      {/* ── Dropdown Trigger ──
           Stitch-tone: tonal card (no border), rounded-lg, smooth
           transition on hover + aria-expanded announcement. */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="prompt-selector-list"
        className="w-full rounded-lg bg-[var(--surface-container-low)] p-3 text-left transition hover:bg-[var(--surface-container-high)] focus-visible:bg-[var(--surface-container-high)]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-strong)]">
            <Settings2 className="h-4 w-4 text-[var(--brand)]" />
            프롬프트 설정
          </span>
          <span className="text-[var(--ink-muted)]">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </div>

        {/* "현재 선택" inner tile — tonal shift on hover via parent. */}
        <div className="mt-3 rounded-lg bg-[var(--bg-card)] p-3">
          <p className="label-sm mb-1 text-[var(--ink-muted)]">현재 선택</p>
          <p className="text-sm font-medium text-[var(--ink-strong)]">
            {selectedPrompt?.name || '기본 회의록 프롬프트'}
          </p>
        </div>
      </button>

      {expanded ? (
        <ul
          id="prompt-selector-list"
          role="list"
          className="motion-rise mt-3 space-y-2"
        >
          {prompts.map((prompt) => {
            const isSelected = selectedPromptId === prompt.id;
            return (
              <li key={prompt.id}>
                {/* ── Menu Item ──
                     Stitch-tone selection: tonal bg, no borders.
                     - Selected: brand-tinted surface + brand ink.
                     - Unselected: surface-container-low, lifts to
                       surface-container-high on hover. */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => void handleChange(prompt.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleChange(prompt.id);
                    }
                  }}
                  className={`block w-full cursor-pointer rounded-lg p-3 text-left transition ${
                    isSelected
                      ? 'bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]'
                      : 'bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      {/* Radio indicator — tonal fill, no 1px borders.
                          Selected: brand disk w/ inner dot.
                          Unselected: tonal container disk. */}
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition ${
                          isSelected
                            ? 'bg-[var(--brand)]'
                            : 'bg-[var(--surface-container-high)]'
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        ) : null}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          isSelected
                            ? 'text-[var(--brand)]'
                            : 'text-[var(--ink-strong)]'
                        }`}
                      >
                        {prompt.name}
                      </span>
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                        {PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {prompt.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                          <Sparkles className="h-3 w-3" />
                          기본
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(prompt);
                            }}
                            className="rounded-full p-1 text-[var(--ink-muted)] transition hover:bg-black/5 hover:text-[var(--ink-strong)]"
                            aria-label="편집"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {deleteConfirmId === prompt.id ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(prompt.id);
                              }}
                              className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"
                            >
                              삭제 확인
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(prompt.id);
                              }}
                              className="rounded-full p-1 text-[var(--ink-muted)] transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="삭제"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--ink-muted)]">
                    {prompt.content}
                  </p>
                </div>
              </li>
            );
          })}

          <li>
            {/* "새 프롬프트 만들기" — Stitch-tone tonal CTA.
                rounded-lg, no border, lifts tonally on hover. */}
            <button
              type="button"
              onClick={openCreate}
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--surface-container-high)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              새 프롬프트 만들기
            </button>
          </li>
        </ul>
      ) : null}

      <PromptEditorDialog
        key={editingPromptId ?? 'create'}
        open={editorOpen}
        mode={editorMode}
        initialName={editorInitialName}
        initialContent={editorInitialContent}
        initialDocumentType={editorInitialDocumentType}
        isLoading={isSaving}
        onSave={handleSave}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}
