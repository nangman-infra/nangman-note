'use client';

import { CheckSquare, RotateCcw, Square, Trash2 } from 'lucide-react';

interface MeetingListBulkToolbarProps {
  showTrash: boolean;
  selectedCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkRestore: () => void;
  onBulkPurge: () => void;
}

export function MeetingListBulkToolbar({
  showTrash,
  selectedCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkRestore,
  onBulkPurge,
}: MeetingListBulkToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-soft)] bg-brand/5 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
        >
          {isAllSelected ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          {isAllSelected ? '전체 해제' : '전체 선택'}
        </button>
        <span className="text-xs font-semibold text-muted">
          {selectedCount}개 선택
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {showTrash ? (
          <>
            <button
              type="button"
              onClick={onBulkRestore}
              disabled={selectedCount === 0}
              className="btn-neo inline-flex whitespace-nowrap px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              복구
            </button>
            <button
              type="button"
              onClick={onBulkPurge}
              disabled={selectedCount === 0}
              className="btn-neo inline-flex whitespace-nowrap border-transparent bg-rose-600 px-2.5 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onBulkDelete}
            disabled={selectedCount === 0}
            className="btn-neo inline-flex whitespace-nowrap border-transparent bg-rose-600 px-2.5 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
