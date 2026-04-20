'use client';

import { createContext, useContext, useState } from 'react';
import { Columns3, FileText, PanelLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';

/* ------------------------------------------------------------------ */
/* LayoutContext                                                       */
/* ------------------------------------------------------------------ */
type ActiveView = 'dashboard' | 'viewer';

interface LayoutContextValue {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within TwoColumnLayout');
  return ctx;
}

/* ------------------------------------------------------------------ */

interface TwoColumnLayoutProps {
  sidebar: React.ReactNode;
  dashboard: React.ReactNode;
  viewer: React.ReactNode;
  showViewer: boolean;
  /**
   * Optional breadcrumb slot rendered inside the mobile top bar, between the
   * brand and the right-side actions. Desktop layout is unaffected because the
   * mobile header is only visible under `lg:hidden`.
   */
  breadcrumb?: React.ReactNode;
}

export function TwoColumnLayout({ sidebar, dashboard, viewer, showViewer, breadcrumb }: TwoColumnLayoutProps) {
  const [activeView, setActiveView] = useState<ActiveView>(showViewer ? 'viewer' : 'dashboard');

  // Sync showViewer prop → internal state
  const resolvedView = showViewer ? 'viewer' : 'dashboard';

  return (
    <LayoutContext.Provider value={{ activeView: resolvedView, setActiveView }}>
      {/* ── Mobile (< lg) ── */}
      <div className="h-dvh bg-[var(--bg-root)] lg:hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 bg-slate-50/80 px-4 py-2.5 shadow-sm backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-headline text-sm font-extrabold tracking-tighter text-indigo-700">Nangman Note</span>
            {breadcrumb ? (
              <div className="min-w-0 flex-1 truncate text-xs text-[var(--ink-muted)]">{breadcrumb}</div>
            ) : null}
          </div>
          <div className="inline-flex flex-shrink-0 rounded-lg bg-[var(--surface-container-low)] p-1">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                resolvedView === 'dashboard' ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              대시보드
            </button>
            <button
              type="button"
              onClick={() => setActiveView('viewer')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                resolvedView === 'viewer' ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              문서
            </button>
          </div>
        </header>

        <div className="h-[calc(100dvh-3rem)] overflow-hidden">
          {resolvedView === 'dashboard' ? (
            <div className="h-full overflow-y-auto">
              <ErrorBoundary>{dashboard}</ErrorBoundary>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <ErrorBoundary>{viewer}</ErrorBoundary>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop (≥ lg): Fixed sidebar + Main content ── */}
      <div className="hidden h-dvh lg:flex">
        {/* Fixed Sidebar — Stitch style: bg-slate-100, w-64 */}
        <aside className="flex h-full w-64 flex-shrink-0 flex-col bg-slate-100">
          <ErrorBoundary>{sidebar}</ErrorBoundary>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {resolvedView === 'viewer' && showViewer ? (
            <div className="h-full overflow-hidden bg-[var(--bg-root)]">
              <ErrorBoundary>{viewer}</ErrorBoundary>
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-[var(--bg-root)]">
              <ErrorBoundary>{dashboard}</ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
