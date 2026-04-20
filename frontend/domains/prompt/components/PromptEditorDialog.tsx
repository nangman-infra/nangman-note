'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Sparkles, X } from 'lucide-react';
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

/* ─────────────────────────────────────────────────────────────
   Static AI Tips rendered in the right-rail `ai-card-accent` card.
   These are authoring guidance notes — kept local to the component
   because the Stitch design treats them as a design element
   (part of the editor chrome), not dynamic data.
   ───────────────────────────────────────────────────────────── */
const AI_WRITING_TIPS: readonly string[] = [
  '기본 타입(회의록/강의/멘토링)이 문서 구조를 정합니다. 덧붙이는 내용은 강조점과 톤만 조정하세요.',
  '숫자와 날짜는 원문 그대로 유지하도록 지시하면 정확도가 올라갑니다.',
  '항목 순서를 명시하면 결과물이 일관됩니다.',
] as const;

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

  /* ─── Derived validation state ───────────────────────────────
     The existing isValid gate (both name + content non-empty) drives
     form submission. The Validation card on the right rail surfaces
     the individual checks so users can see what still needs filling
     and why the Save button is disabled. */
  const trimmedName = name.trim();
  const trimmedContent = content.trim();
  const nameFilled = trimmedName.length > 0;
  const contentFilled = trimmedContent.length > 0;
  const nameWithinLimit = name.length <= PROMPT_NAME_MAX_LENGTH;
  const contentWithinLimit = content.length <= PROMPT_CONTENT_MAX_LENGTH;
  const isValid =
    nameFilled && contentFilled && nameWithinLimit && contentWithinLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSave(trimmedName, trimmedContent, documentType);
  };

  return (
    <dialog
      ref={dialogRef}
      /* Widened to max-w-5xl so the 8/4 desktop split (editor + sidebar)
         has room; below `lg` the grid collapses to a single column. */
      className="m-auto w-full max-w-5xl rounded-xl bg-transparent p-0 backdrop:bg-black/30"
    >
      <form
        onSubmit={handleSubmit}
        className="surface-card w-full space-y-5 p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-bold tracking-tight">
            {mode === 'create' ? '새 프롬프트 만들기' : '프롬프트 편집'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-full p-1 text-muted transition hover:bg-black/5"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 8/4 split grid — stacks vertically below `lg`. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* ── Left 8/12: Editor form ──
               Labels use the shared `label-sm` utility (Inter, 10px, uppercase,
               0.05em tracking) so the form headers read as Stitch technical
               metadata rather than ad-hoc semibold text. Field groups separate
               via vertical spacing (`space-y-4`) per the No-Line rule — no
               dividers or borders between groups. */}
          <div className="space-y-4 lg:col-span-8">
            <div>
              <label
                htmlFor="prompt-name"
                className="label-sm mb-1.5 block text-[var(--ink-muted)]"
              >
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
                  {name.length.toLocaleString()}/
                  {PROMPT_NAME_MAX_LENGTH.toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="prompt-document-type"
                className="label-sm mb-1.5 block text-[var(--ink-muted)]"
              >
                기본 문서 타입
              </label>
              <select
                id="prompt-document-type"
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value as PromptDocumentType)
                }
                className="input-shell w-full"
                disabled={isLoading}
              >
                {Object.entries(PROMPT_DOCUMENT_TYPE_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                {PROMPT_DOCUMENT_TYPE_HELP_TEXT[documentType]}
              </p>
            </div>

            <div>
              <label
                htmlFor="prompt-content"
                className="label-sm mb-1.5 block text-[var(--ink-muted)]"
              >
                추가 강조 지시
              </label>
              <textarea
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={PROMPT_CONTENT_MAX_LENGTH}
                placeholder="예: 실무 팁과 후속 과제를 더 분명하게 정리해줘"
                rows={12}
                className="input-shell w-full resize-y font-mono text-sm"
                disabled={isLoading}
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-muted">
                  기본 타입의 구조는 유지하고, 이 프롬프트는 강조점과 표현
                  방식만 추가합니다.
                </p>
                <p
                  className={`text-[11px] tabular-nums ${
                    content.length > PROMPT_CONTENT_MAX_LENGTH * 0.9
                      ? 'text-rose-500'
                      : 'text-muted'
                  }`}
                >
                  {content.length.toLocaleString()}/
                  {PROMPT_CONTENT_MAX_LENGTH.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Right 4/12: Validation + AI Tip sidebar ──
               Below `lg` these stack beneath the form so mobile users
               still see them without horizontal scroll. */}
          <aside className="space-y-4 lg:col-span-4">
            {/* Validation card — real-time feedback on required fields.
                We deliberately avoid a live "Test with Context" action
                because no backend endpoint exists to run a prompt against
                past meetings; instead we hint at post-save testing. */}
            <section
              aria-labelledby="prompt-validation-heading"
              className="surface-card p-4"
            >
              <header className="mb-3 flex items-center gap-2">
                <span
                  className="relative inline-flex h-2 w-2 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40 ai-pulse-dot" />
                  <span className="relative h-2 w-2 rounded-full bg-[var(--tertiary)]" />
                </span>
                <h4
                  id="prompt-validation-heading"
                  className="label-sm text-[var(--ink-muted)]"
                >
                  검증
                </h4>
              </header>

              <ul className="space-y-2 text-xs" role="list">
                <ValidationRow
                  ok={nameFilled && nameWithinLimit}
                  label={
                    !nameFilled
                      ? '프롬프트 이름을 입력해주세요.'
                      : !nameWithinLimit
                        ? `이름은 ${PROMPT_NAME_MAX_LENGTH}자 이내여야 합니다.`
                        : '프롬프트 이름이 입력되었습니다.'
                  }
                />
                <ValidationRow
                  ok={contentFilled && contentWithinLimit}
                  label={
                    !contentFilled
                      ? '강조 지시 내용을 입력해주세요.'
                      : !contentWithinLimit
                        ? `내용은 ${PROMPT_CONTENT_MAX_LENGTH.toLocaleString()}자 이내여야 합니다.`
                        : `강조 지시가 ${trimmedContent.length.toLocaleString()}자 작성되었습니다.`
                  }
                />
              </ul>

              <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
                저장 후 새 회의에서 이 프롬프트를 선택해 실제로 테스트해보세요.
              </p>
            </section>

            {/* AI Tip card — uses `ai-card-accent` (4px tertiary bar +
                surface-container-highest background) per Stitch spec. */}
            <section
              aria-labelledby="prompt-ai-tip-heading"
              className="ai-card-accent rounded-r-xl p-4"
            >
              <header className="mb-3 flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4 text-[var(--tertiary)]"
                  aria-hidden="true"
                />
                <h4
                  id="prompt-ai-tip-heading"
                  className="label-sm text-[var(--tertiary)]"
                >
                  AI 작성 팁
                </h4>
              </header>

              <ul
                className="space-y-2 text-xs leading-relaxed text-[var(--ink-strong)]"
                role="list"
              >
                {AI_WRITING_TIPS.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]"
                      aria-hidden="true"
                    />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        {/* Action row — full-width footer stays below the grid.
            Uses Stitch button system (FR-8): `btn-secondary` for the
            cancel/dismiss action (ghost, no-fill) and `btn-primary`
            for the confirm action (135° indigo gradient, white text,
            ambient shadow). Both inherit `rounded-lg` (8px) from the
            utility definitions (FR-10). */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-secondary inline-flex px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="btn-primary inline-flex px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? '저장 중...' : mode === 'create' ? '생성' : '저장'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   ValidationRow — small presentational helper. Kept inside this
   file because it is only meaningful for the editor's right-rail
   card and has no consumers elsewhere.
   ───────────────────────────────────────────────────────────── */
function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600"
          aria-hidden="true"
        />
      ) : (
        <AlertCircle
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500"
          aria-hidden="true"
        />
      )}
      <span
        className={ok ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}
      >
        {label}
      </span>
    </li>
  );
}
