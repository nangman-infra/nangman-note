'use client';

import { createContext, useContext, useState } from 'react';
import { Columns3, FileText } from 'lucide-react';
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
  mobileView?: ActiveView;
  onMobileViewChange?: (view: ActiveView) => void;
  /**
   * Optional breadcrumb slot rendered inside the mobile top bar, between the
   * brand and the right-side actions. Desktop layout is unaffected because the
   * mobile header is only visible under `lg:hidden`.
   */
  breadcrumb?: React.ReactNode;
  mobileNavigation?: React.ReactNode;
}

export function TwoColumnLayout({
  sidebar,
  dashboard,
  viewer,
  showViewer,
  mobileView,
  onMobileViewChange,
  breadcrumb,
  mobileNavigation,
}: TwoColumnLayoutProps) {
  const [internalActiveView, setInternalActiveView] = useState<ActiveView>(
    showViewer ? 'viewer' : 'dashboard',
  );
  const activeView = mobileView ?? internalActiveView;
  const setActiveView = onMobileViewChange ?? setInternalActiveView;
  const mobileResolvedView = showViewer ? activeView : 'dashboard';
  const desktopResolvedView = showViewer ? 'viewer' : 'dashboard';

  return (
    <LayoutContext.Provider value={{ activeView: mobileResolvedView, setActiveView }}>
      {/* ── Mobile (< lg) ── */}
      <div className="flex h-dvh flex-col bg-[var(--bg-root)] lg:hidden">
        {/* Mobile top bar */}
        <header className="border-b border-[var(--line-soft)] bg-white/90 px-4 py-2 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-headline text-sm text-brand">TransNote</span>
              {breadcrumb ? (
                <div className="min-w-0 flex-1 truncate text-xs text-[var(--ink-muted)]">{breadcrumb}</div>
              ) : null}
            </div>
            <div className="inline-flex flex-shrink-0 rounded-lg border border-[var(--line-soft)] bg-[var(--surface-container-low)] p-0.5">
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium transition ${
                  mobileResolvedView === 'dashboard' ? 'bg-brand text-white shadow-[var(--elevation-button)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                대시보드
              </button>
              <button
                type="button"
                onClick={() => setActiveView('viewer')}
                disabled={!showViewer}
                className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium transition ${
                  mobileResolvedView === 'viewer' ? 'bg-brand text-white shadow-[var(--elevation-button)]' : 'text-[var(--ink-muted)]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <FileText className="h-3.5 w-3.5" />
                문서
              </button>
            </div>
          </div>
          {mobileNavigation ? <div className="mt-2">{mobileNavigation}</div> : null}
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mobileResolvedView === 'dashboard' ? (
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
        {/* Fixed Sidebar — white rail, Silver Lining hairline */}
        <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-[var(--line-soft)] bg-[var(--bg-card)]">
          <ErrorBoundary>{sidebar}</ErrorBoundary>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {desktopResolvedView === 'viewer' && showViewer ? (
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
