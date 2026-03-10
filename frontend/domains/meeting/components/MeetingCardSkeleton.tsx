'use client';

/**
 * MeetingCard 형태의 스켈레톤 UI.
 * 로딩 시 MeetingCard와 동일한 구조를 pulse 애니메이션으로 표시하여
 * 체감 로딩 시간을 줄인다.
 */
export function MeetingCardSkeleton() {
  return (
    <div className="surface-card w-full p-4" aria-hidden="true">
      {/* 상단: 제목 + 상태 배지 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
      </div>

      {/* 하단: 날짜 + 시간 */}
      <div className="space-y-1.5">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
