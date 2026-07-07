'use client';

interface MeetingListLoadMoreFooterProps {
  hiddenCount: number;
  sortedCount: number;
  visibleCount: number;
  onShowAll: () => void;
}

export function MeetingListLoadMoreFooter({
  hiddenCount,
  sortedCount,
  visibleCount,
  onShowAll,
}: MeetingListLoadMoreFooterProps) {
  if (hiddenCount <= 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-[var(--line-soft)] bg-white px-4 py-3">
      <button
        type="button"
        onClick={onShowAll}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--surface-container-low)] px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-[var(--surface-container-high)]"
      >
        회의 {hiddenCount}개 더 보기
      </button>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        전체 {sortedCount}개 중 최근 {visibleCount}개 · 검색으로도 찾을 수 있어요
      </p>
    </div>
  );
}
