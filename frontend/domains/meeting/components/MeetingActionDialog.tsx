'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export type MeetingActionType = 'move-to-trash' | 'purge';

interface MeetingActionDialogProps {
  open: boolean;
  actionType: MeetingActionType;
  meetingTitle: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MeetingActionDialog({
  open,
  actionType,
  meetingTitle,
  isLoading = false,
  onConfirm,
  onCancel,
}: MeetingActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    },
    [isLoading, onCancel],
  );

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current && !isLoading) {
        onCancel();
      }
    },
    [isLoading, onCancel],
  );

  if (!open) return null;

  const isPurge = actionType === 'purge';
  const heading = isPurge ? '회의를 영구 삭제할까요?' : '회의를 휴지통으로 이동할까요?';
  const description = isPurge
    ? '영구 삭제 후에는 복구할 수 없습니다.'
    : '휴지통에서 복구하거나 영구 삭제할 수 있습니다.';
  const confirmLabel = isPurge ? '영구 삭제' : '휴지통 이동';

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-[22px] border border-[var(--line-soft)] bg-[var(--bg-card)] p-0 shadow-[0_14px_38px_rgba(15,23,42,0.15)] backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="inline-flex rounded-full bg-rose-100 p-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          {!isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-muted transition hover:bg-[var(--line-soft)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-foreground">&quot;{meetingTitle || '제목 없는 회의'}&quot;</span>
          <br />
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-neo px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="btn-neo border-transparent bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isLoading ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

