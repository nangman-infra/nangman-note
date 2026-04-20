'use client';

/**
 * MeetingCard 형태의 스켈레톤 UI.
 * 로딩 시 MeetingCard와 동일한 레이아웃(아이콘 타일 + 제목 + 메타 + 상태)을
 * pulse 애니메이션으로 표시해 실제 카드로 교체될 때 레이아웃 시프트가
 * 발생하지 않도록 한다.
 *
 * Stitch 사양:
 * - No-Line Rule: border 금지, 배경 톤으로 구획 (bg-white 기본)
 * - rounded-xl (12px) + p-5 로 실제 카드 footprint 일치
 * - Skeleton 자체에는 shadow 없음 (실제 카드는 hover/active 시에만 shadow)
 * - Placeholder bar는 surface-container-high 톤으로 뚜렷하게 표시
 */
export function MeetingCardSkeleton() {
  return (
    <div
      className="w-full rounded-xl bg-white p-5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-4">
        {/* Icon tile */}
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-[var(--surface-container-high)]" />

        {/* Title + meta */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-container-high)]" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-container-high)]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-container-high)]" />
          </div>
        </div>

        {/* Status pill placeholder */}
        <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
      </div>
    </div>
  );
}
