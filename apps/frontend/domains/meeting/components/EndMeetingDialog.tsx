'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Square, X } from 'lucide-react';

interface EndMeetingDialogProps {
  open: boolean;
  isLoading?: boolean;
  recordingTime?: string;
  noteLength?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndMeetingDialog({
  open,
  isLoading = false,
  recordingTime,
  noteLength,
  onConfirm,
  onCancel,
}: EndMeetingDialogProps) {
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
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    },
    [isLoading, onCancel],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current && !isLoading) {
        onCancel();
      }
    },
    [isLoading, onCancel],
  );

  if (!open) return null;

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
          {!isLoading && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-muted transition hover:bg-[var(--line-soft)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold">회의를 종료하시겠습니까?</h2>
        <p className="mt-2 text-sm text-muted">
          녹음이 중지되고, 수집된 오디오를 서버로 전송하여 전사를 시작합니다.
          작성하신 노트는 이미 자동 저장되어 있습니다.
        </p>

        {(recordingTime || (noteLength !== undefined && noteLength > 0)) && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {recordingTime && (
              <p>🎙️ 녹음 시간: <span className="font-semibold">{recordingTime}</span></p>
            )}
            {noteLength !== undefined && noteLength > 0 && (
              <p className={recordingTime ? 'mt-1' : ''}>📝 노트 길이: <span className="font-semibold">{noteLength.toLocaleString()}자</span></p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-neo inline-flex px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="btn-neo inline-flex border-transparent bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            {isLoading ? '종료 처리 중...' : '회의 종료'}
          </button>
        </div>
      </div>
    </dialog>
  );
}