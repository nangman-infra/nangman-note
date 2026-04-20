'use client';

import { Square } from 'lucide-react';

/**
 * 회의 진행 중 화면 목업 — 실제 Live Meeting Room (Phase 3) 축소판.
 *
 * 참조: frontend/app/meeting/in-progress/page.tsx
 * - Stitch TopBar: 브랜드 + 브레드크럼 + 타이머 캡슐(tertiary pulse) + 빨간 종료 버튼
 * - 2-pane 본문: 좌측 2/5 다크 슬레이트 전사 패널 / 우측 3/5 `.editor-dot-grid` 노트 패널
 * - 좌측 패널 하단: 오디오 비주얼라이저 바
 *
 * No-Line 규칙: border 대신 배경 톤 전환으로 구획.
 */
export function FlowMockInProgress() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* ── Stitch TopBar ── */}
      <header className="flex items-center justify-between bg-slate-50/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-headline text-[11px] font-extrabold tracking-tighter text-indigo-700">
            Nangman Note
          </span>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1 text-[9px] font-medium text-slate-400"
          >
            <span className="font-semibold text-indigo-700">대시보드</span>
            <span aria-hidden="true">›</span>
            <span className="truncate font-bold text-slate-900">주간 정기회의</span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer capsule with tertiary pulse */}
          <div className="flex items-center rounded-full bg-[var(--surface-container-low)] px-2 py-0.5">
            <div className="relative mr-1.5 flex items-center justify-center" aria-hidden="true">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--tertiary-fixed-dim)]" />
              <div className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40" />
            </div>
            <span className="text-[9px] tracking-widest text-[var(--ink-subtle)]">24:35</span>
          </div>

          {/* Stop button — Stitch error tone */}
          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[9px] font-bold text-white">
            <Square className="h-2.5 w-2.5" aria-hidden="true" />
            종료
          </span>
        </div>
      </header>

      {/* ── 2-pane 본문: 좌 2/5 다크 전사 + 우 3/5 도트 그리드 노트 ── */}
      <div className="grid grid-cols-[2fr_3fr]" style={{ height: 200 }}>
        {/* 좌측: 다크 슬레이트 전사 패널 */}
        <aside className="flex min-h-0 flex-col bg-slate-900 text-slate-100">
          <div className="flex-1 space-y-1.5 overflow-hidden px-2 py-2 text-[9px] leading-snug">
            <div>
              <div className="flex items-center gap-1">
                <span className="rounded bg-teal-400/20 px-1 text-[8px] font-semibold text-teal-300">
                  화자 1
                </span>
                <span className="text-[8px] text-slate-500">00:12</span>
              </div>
              <p className="mt-0.5 text-slate-200">배포 일정부터 확인하겠습니다.</p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="rounded bg-amber-400/20 px-1 text-[8px] font-semibold text-amber-300">
                  화자 2
                </span>
                <span className="text-[8px] text-slate-500">00:28</span>
              </div>
              <p className="mt-0.5 text-slate-200">스테이징은 15일로 잡았습니다.</p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="rounded bg-teal-400/20 px-1 text-[8px] font-semibold text-teal-300">
                  화자 1
                </span>
                <span className="text-[8px] text-slate-500">01:05</span>
              </div>
              <p className="mt-0.5 text-slate-200">QA 시나리오는 누가…</p>
            </div>
          </div>

          {/* Audio Visualizer — 하단 작은 바들 */}
          <div
            className="flex items-end justify-center gap-[2px] bg-slate-950 px-2 py-1.5"
            aria-hidden="true"
          >
            {[3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 5, 8, 4, 6, 3].map((h, i) => (
              <span
                key={i}
                className="w-[2px] rounded-sm bg-[var(--tertiary-fixed-dim)]/80"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </aside>

        {/* 우측: 도트 그리드 노트 패널 */}
        <section className="editor-dot-grid min-h-0 overflow-hidden px-3 py-2">
          <div className="text-[10px] font-bold text-foreground">## 배포 일정</div>
          <div className="mt-0.5 space-y-0.5 text-[9px] leading-relaxed text-muted">
            <p>- 3/15 스테이징 배포 예정</p>
            <p>- QA 시나리오 김OO 담당</p>
          </div>
          <div className="mt-2 text-[10px] font-bold text-foreground">## API 개선</div>
          <div className="mt-0.5 space-y-0.5 text-[9px] leading-relaxed text-muted">
            <p>- 캐시 레이어 도입 논의</p>
          </div>
          <p className="mt-2 text-[8px] italic text-brand/60">마크다운으로 자유롭게 작성…</p>
        </section>
      </div>
    </div>
  );
}
