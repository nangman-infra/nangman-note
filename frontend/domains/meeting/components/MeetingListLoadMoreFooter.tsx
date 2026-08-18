'use client';

interface MeetingListLoadMoreFooterProps {
  hiddenCount: number;
  sortedCount: number;
  visibleCount: number;
  /** 서버에 더 불러올 이전 회의가 남아 있는지 */
  hasMoreOnServer?: boolean;
  isLoadingMore?: boolean;
  onShowAll: () => void;
  /** 서버에서 다음 페이지 로드 */
  onLoadMoreFromServer?: () => void;
}

export function MeetingListLoadMoreFooter({
  hiddenCount,
  sortedCount,
  visibleCount,
  hasMoreOnServer = false,
  isLoadingMore = false,
  onShowAll,
  onLoadMoreFromServer,
}: MeetingListLoadMoreFooterProps) {
  const showClientExpand = hiddenCount > 0;
  const showServerLoadMore =
    !showClientExpand && hasMoreOnServer && Boolean(onLoadMoreFromServer);

  if (!showClientExpand && !showServerLoadMore) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-[var(--line-soft)] bg-white px-4 py-3">
      {showClientExpand ? (
        <>
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
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onLoadMoreFromServer}
            disabled={isLoadingMore}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--surface-container-low)] px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-[var(--surface-container-high)] disabled:opacity-60"
          >
            {isLoadingMore ? '이전 회의 불러오는 중...' : '이전 회의 더 불러오기'}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            서버에 더 오래된 회의가 있습니다
          </p>
        </>
      )}
    </div>
  );
}
