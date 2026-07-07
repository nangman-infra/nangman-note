'use client';

import { ChevronDown, Copy, Download, Edit3, Sparkles } from 'lucide-react';

/**
 * 결과 뷰어 화면 목업 — 실제 Meeting Result (Phase 4) 축소판.
 *
 * 참조: frontend/domains/result/components/ResultViewer.tsx
 * - 상단 헤더: Finished 배지(tertiary-fixed bg) + 메타 라인(날짜 · 길이)
 *   + Manrope 대형 헤드라인(축소 스케일) + 참가자 아바타 스택(-space-x)
 * - 액션 줄: Export 드롭다운(btn-primary, ChevronDown) + 편집 + 복사
 *   (보조 버튼은 btn-secondary 룩)
 * - 탭 바: 활성 탭 `border-b-2 border-brand text-slate-900`,
 *   비활성 탭 `text-[var(--ink-muted)]`
 * - 본문 (AI Summary 탭): 8/4 grid
 *   - 좌측: `ai-card-accent` 축소판 (4px tertiary 좌측 바 + surface-container-highest,
 *     rounded-r) + "AI Summary" 라벨
 *   - 우측: "생성 정보" 메타 카드 (흰 배경 + 작은 섀도우)
 *
 * No-Line 규칙: 구획 경계 border 제거, 배경 톤 전환으로만 나눈다.
 */
export function FlowMockResult() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* ── 헤더: 배지 · 메타 · 헤드라인 · 아바타 스택 · 액션 ── */}
      <header className="space-y-2 px-3 pb-3 pt-3">
        {/* Finished badge + 메타 라인 */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-[var(--tertiary-fixed)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[var(--tertiary)]">
            Finished
          </span>
          <span className="text-[9px] font-medium text-[var(--ink-muted)]">
            2026년 3월 12일 · 48분
          </span>
        </div>

        {/* Manrope 축소판 헤드라인 */}
        <h2 className="font-headline text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">
          주간 정기회의
        </h2>

        {/* 참가자 아바타 스택 */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5" aria-label="참가자 3명">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[7px] font-bold text-white ring-1 ring-white">
              S1
            </span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[7px] font-bold text-white ring-1 ring-white">
              S2
            </span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-white ring-1 ring-white">
              S3
            </span>
          </div>
          <span className="text-[9px] font-medium text-[var(--ink-muted)]">
            참가자 3명
          </span>
        </div>

        {/* 액션 줄: Export 드롭다운 + 편집 + 복사 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Export — btn-primary 축소판 */}
          <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[9px] font-bold text-white shadow-sm">
            <Download className="h-2.5 w-2.5" aria-hidden="true" />
            Export
            <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
          {/* 편집 — btn-secondary 룩 */}
          <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-[9px] font-semibold text-brand">
            <Edit3 className="h-2.5 w-2.5" aria-hidden="true" />
            편집
          </span>
          {/* 복사 — btn-secondary 룩 */}
          <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-[9px] font-semibold text-brand">
            <Copy className="h-2.5 w-2.5" aria-hidden="true" />
            복사
          </span>
        </div>
      </header>

      {/* ── 탭 바 (No-Line: 배경 톤으로 구획, 활성 탭만 2px brand bar) ── */}
      <div className="flex gap-4 bg-[var(--surface-container-low)] px-3">
        <span className="border-b-2 border-brand py-1.5 text-[9px] font-bold tracking-wide text-slate-900">
          AI Summary
        </span>
        <span className="border-b-2 border-transparent py-1.5 text-[9px] font-bold tracking-wide text-[var(--ink-muted)]">
          Full Transcript
        </span>
        <span className="border-b-2 border-transparent py-1.5 text-[9px] font-bold tracking-wide text-[var(--ink-muted)]">
          Original Notes
        </span>
      </div>

      {/* ── 본문: 8/4 grid (AI Summary 탭) ── */}
      <div className="grid grid-cols-12 gap-2 p-3">
        {/* 좌측(8): ai-card-accent 축소판 */}
        <div className="col-span-8">
          <div className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-[var(--tertiary)]">
            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
            AI Summary
          </div>
          <article className="ai-card-accent rounded-r-lg p-2.5">
            <p className="text-[10px] font-bold text-slate-900">
              1. 배포 일정 확정
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-[var(--ink-subtle)]">
              3/15 스테이징, 3/18 프로덕션 배포로 합의. QA 시나리오는 3/13까지
              김OO이 작성.
            </p>
            <p className="mt-1.5 text-[10px] font-bold text-slate-900">
              2. API 응답 속도 개선
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-[var(--ink-subtle)]">
              Redis 캐시 레이어 도입에 합의.
            </p>
          </article>
        </div>

        {/* 우측(4): 생성 정보 메타 카드 */}
        <aside className="col-span-4">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <h3 className="mb-1 text-[8px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              생성 정보
            </h3>
            <dl className="space-y-1">
              <div className="flex items-baseline justify-between gap-1.5">
                <dt className="text-[8px] text-[var(--ink-muted)]">단어</dt>
                <dd className="font-mono text-[8px] font-semibold text-slate-900">
                  4,238
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-1.5">
                <dt className="text-[8px] text-[var(--ink-muted)]">노트</dt>
                <dd className="font-mono text-[8px] font-semibold text-slate-900">
                  312자
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
