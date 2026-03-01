'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react';

export type MeetingActionType = 'move-to-trash' | 'purge' | 'bulk-delete' | 'bulk-purge' | 'bulk-restore';

interface MeetingActionDialogProps {
  open: boolean;
  actionType: MeetingActionType;
  meetingTitle: string;
  /** bulk 작업 시 선택된 항목 수 */
  bulkCount?: number;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MeetingActionDialog({
  open,
  actionType,
  meetingTitle,
  bulkCount,
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

  const isBulk = actionType.startsWith('bulk-');
  const countLabel = isBulk && bulkCount ? `${bulkCount}개의 회의를` : '';

  let heading: string;
  let description: string;
  let confirmLabel: string;

  switch (actionType) {
    case 'bulk-delete':
      heading = `${countLabel} 휴지통으로 이동할까요?`;
      description = '선택한 회의들이 휴지통으로 이동됩니다. 휴지통에서 복구하거나 영구 삭제할 수 있습니다.';
      confirmLabel = '일괄 삭제';
      break;
    case 'bulk-purge':
      heading = `${countLabel} 영구 삭제할까요?`;
      description = '선택한 회의들이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.';
      confirmLabel = '일괄 영구 삭제';
      break;
    case 'bulk-restore':
      heading = `${countLabel} 복구할까요?`;
      description = '선택한 회의들이 복구되어 회의 목록으로 돌아갑니다.';
      confirmLabel = '일괄 복구';
      break;
    case 'purge':
      heading = '회의를 영구 삭제할까요?';
      description = '영구 삭제 후에는 복구할 수 없습니다.';
      confirmLabel = '영구 삭제';
      break;
    default:
      heading = '회의를 휴지통으로 이동할까요?';
      description = '휴지통에서 복구하거나 영구 삭제할 수 있습니다.';
      confirmLabel = '휴지통 이동';
  }

  const isRestore = actionType === 'bulk-restore';

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
          {isBulk ? null : (
            <>
              <span className="font-semibold text-foreground">&quot;{meetingTitle || '제목 없는 회의'}&quot;</span>
              <br />
            </>
          )}
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
            className={`btn-neo border-transparent px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              isRestore
                ? 'bg-brand hover:bg-brand/90 hover:text-white'
                : 'bg-rose-600 hover:bg-rose-700 hover:text-white'
            }`}
          >
            {isRestore ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {isLoading ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

