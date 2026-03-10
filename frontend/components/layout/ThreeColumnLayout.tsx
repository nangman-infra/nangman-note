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

export function ThreeColumnLayout({ sidebar, list, viewer }: ThreeColumnLayoutProps) {
  // Layout visibility is handled by CSS media queries (hidden lg:block / lg:hidden)
  // to prevent SSR/hydration CLS. useMediaQuery can be added back for compact mode
  // internal tab switching logic (e.g., auto-switch to viewer on meeting selection).
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>('list');

  const columnIndex = activeColumn === 'sidebar' ? 0 : activeColumn === 'list' ? 1 : 2;

  return (
    <LayoutContext.Provider value={{ setActiveColumn }}>
      {/* Compact layout: visible on screens ≤1024px (lg breakpoint), hidden on desktop */}
      <div className="app-shell h-dvh p-3 lg:hidden">
        <header className="glass-surface motion-rise mb-3 flex items-center justify-between px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-muted">WORKSPACE</p>
          <div className="inline-flex rounded-xl border border-[var(--line-soft)] bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setActiveColumn('sidebar')}
              className={`btn-neo inline-flex px-3 py-1 text-xs ${
                activeColumn === 'sidebar' ? 'border-transparent bg-brand text-white' : 'border-transparent'
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              메뉴
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('list')}
              className={`btn-neo inline-flex px-3 py-1 text-xs ${
                activeColumn === 'list' ? 'border-transparent bg-brand text-white' : 'border-transparent'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              목록
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('viewer')}
              className={`btn-neo inline-flex px-3 py-1 text-xs ${
                activeColumn === 'viewer' ? 'border-transparent bg-brand text-white' : 'border-transparent'
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
            <div className="w-full flex-shrink-0"><ErrorBoundary>{sidebar}</ErrorBoundary></div>
            <div className="w-full flex-shrink-0"><ErrorBoundary>{list}</ErrorBoundary></div>
            <div className="w-full flex-shrink-0"><ErrorBoundary>{viewer}</ErrorBoundary></div>
          </div>
        </div>
      </div>

      {/* Desktop layout: visible on screens >1024px, hidden on compact */}
      {/* lg (1024-1280px): sidebar 64px icon-only, list 300px, viewer gets rest (500px+) */}
      {/* xl (1280px+): sidebar 280px, list 360px, viewer gets rest — original proportions */}
      <div className="app-shell hidden h-dvh p-4 lg:block">
        <div className="grid h-full grid-cols-[64px_300px_minmax(500px,1fr)] xl:grid-cols-[280px_360px_minmax(0,1fr)] gap-4">
          <aside aria-label="사이드바 네비게이션" className="glass-surface overflow-hidden motion-rise"><ErrorBoundary>{sidebar}</ErrorBoundary></aside>
          <section aria-label="회의 목록" className="glass-surface overflow-hidden motion-rise"><ErrorBoundary>{list}</ErrorBoundary></section>
          <main aria-label="회의 결과 뷰어" className="glass-surface overflow-hidden motion-rise"><ErrorBoundary>{viewer}</ErrorBoundary></main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
