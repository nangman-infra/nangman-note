'use client';

import type { RefObject } from 'react';

interface ResultRegenerateConfirmDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResultRegenerateConfirmDialog({
  dialogRef,
  onClose,
  onCancel,
  onConfirm,
}: ResultRegenerateConfirmDialogProps) {
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-auto rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <h3 className="text-base font-semibold">재생성 확인</h3>
      <p className="mt-2 text-sm text-muted">
        현재 회의록이 새 결과로 대체됩니다. 계속하시겠습니까?
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-neo inline-flex px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-neo inline-flex border-transparent bg-brand px-4 py-2 text-sm text-white hover:bg-brand-strong hover:text-white"
        >
          계속
        </button>
      </div>
    </dialog>
  );
}
