'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PromptDocumentType } from '../types/prompt.types';
import { PromptEditorFields } from './PromptEditorFields';
import { PromptEditorSidebar } from './PromptEditorSidebar';
import {
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_NAME_MAX_LENGTH,
  getPromptSubmitLabel,
} from './promptEditorConfig';

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
          <PromptEditorFields
            name={name}
            content={content}
            documentType={documentType}
            isLoading={isLoading}
            setName={setName}
            setContent={setContent}
            setDocumentType={setDocumentType}
          />
          <PromptEditorSidebar
            nameFilled={nameFilled}
            contentFilled={contentFilled}
            nameWithinLimit={nameWithinLimit}
            contentWithinLimit={contentWithinLimit}
            trimmedContentLength={trimmedContent.length}
          />
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
            {getPromptSubmitLabel(isLoading, mode)}
          </button>
        </div>
      </form>
    </dialog>
  );
}
