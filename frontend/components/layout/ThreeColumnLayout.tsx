'use client';

import { createContext, useContext, useState } from 'react';
import { Columns3, FileText, PanelLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';

/* ------------------------------------------------------------------ */
/* LayoutContext — allows child components to control compact-mode tab */
/* ------------------------------------------------------------------ */
type ActiveColumn = 'sidebar' | 'list' | 'viewer';

interface LayoutContextValue {
  setActiveColumn: (col: ActiveColumn) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);
const COLUMN_INDEX_BY_NAME: Record<ActiveColumn, number> = {
  sidebar: 0,
  list: 1,
  viewer: 2,
};

/**
 * @deprecated `ThreeColumnLayout`과 함께 쓰이는 레거시 컨텍스트 훅이다.
 * 새 코드에서는 사용하지 말 것. 상세는 `ThreeColumnLayout` JSDoc 참고.
 */
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within ThreeColumnLayout');
  return ctx;
}

/* ------------------------------------------------------------------ */

interface ThreeColumnLayoutProps {
  sidebar: React.ReactNode;
  list: React.ReactNode;
  viewer: React.ReactNode;
}

/**
 * @deprecated
 * 이 레이아웃은 더 이상 어떤 `app/**` 라우트에서도 사용되지 않는다.
 * 실제 서비스 쉘은 `TwoColumnLayout` (Sidebar + 메인 영역)로 통합됐으며,
 * 대시보드의 "목록 + 뷰어" 이중 컬럼은 `app/page.tsx`에서 `TwoColumnLayout`
 * 메인 슬롯 안에 2-column 그리드로 구성된다.
 *
 * 새 작업에서는 `TwoColumnLayout`을 사용하라. 이 컴포넌트는 아래 두 테스트가
 * 회귀 감지용 소스 스캔을 수행하는 한 파일 자체가 보존되어야 하므로
 * 삭제하지 않고 보관한다:
 *   - `frontend/components/layout/ThreeColumnLayout.spec.tsx`
 *   - `frontend/__tests__/ux-audit-preservation.test.tsx`
 *   - `frontend/__tests__/ux-audit-bug-exploration.test.tsx`
 */
export function ThreeColumnLayout({ sidebar, list, viewer }: ThreeColumnLayoutProps) {
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>('list');

  const columnIndex = COLUMN_INDEX_BY_NAME[activeColumn];

  return (
    <LayoutContext.Provider value={{ setActiveColumn }}>
      {/* Compact layout: visible on screens ≤1024px (lg breakpoint), hidden on desktop */}
      <div className="h-dvh bg-[var(--bg-root)] p-3 lg:hidden">
        {/* Mobile top bar */}
        <header className="mb-3 flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-2.5 shadow-sm backdrop-blur-xl motion-rise">
          <span className="font-headline text-sm font-extrabold tracking-tighter text-indigo-700">Nangman Note</span>
          <div className="inline-flex rounded-lg bg-[var(--surface-container-low)] p-1">
            <button
              type="button"
              onClick={() => setActiveColumn('sidebar')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeColumn === 'sidebar' ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              메뉴
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeColumn === 'list' ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              목록
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('viewer')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeColumn === 'viewer' ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              문서
            </button>
          </div>
        </header>

        <div className="glass-surface h-[calc(100dvh-5.5rem)] overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${columnIndex * 100}%)` }}
          >
            <div className="w-full flex-shrink-0 overflow-hidden">
              <ErrorBoundary>{sidebar}</ErrorBoundary>
            </div>
            <div className="w-full flex-shrink-0 overflow-hidden">
              <ErrorBoundary>{list}</ErrorBoundary>
            </div>
            <div className="w-full flex-shrink-0 overflow-hidden">
              <ErrorBoundary>{viewer}</ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop layout: visible on screens >1024px, hidden on compact */}
      {/* Stitch: Clean surface layering — no grid overlay, no heavy glass */}
      <div className="hidden h-dvh bg-slate-100 p-4 lg:block">
        <div className="grid h-full grid-cols-[64px_300px_minmax(500px,1fr)] xl:grid-cols-[280px_360px_minmax(0,1fr)] gap-4">
          <aside
            aria-label="사이드바 네비게이션"
            className="overflow-hidden rounded-2xl bg-slate-100 motion-rise"
          >
            <ErrorBoundary>{sidebar}</ErrorBoundary>
          </aside>
          <section
            aria-label="회의 목록"
            className="glass-surface overflow-hidden motion-rise"
          >
            <ErrorBoundary>{list}</ErrorBoundary>
          </section>
          <main
            aria-label="회의 결과 뷰어"
            className="glass-surface overflow-hidden motion-rise"
          >
            <ErrorBoundary>{viewer}</ErrorBoundary>
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
