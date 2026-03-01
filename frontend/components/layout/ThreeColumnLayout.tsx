'use client';

import { useState } from 'react';
import { Columns3, FileText, PanelLeft } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ThreeColumnLayoutProps {
  sidebar: React.ReactNode;
  list: React.ReactNode;
  viewer: React.ReactNode;
}

export function ThreeColumnLayout({ sidebar, list, viewer }: ThreeColumnLayoutProps) {
  const isCompact = useMediaQuery('(max-width: 1024px)');
  const [activeColumn, setActiveColumn] = useState<'sidebar' | 'list' | 'viewer'>('list');

  if (isCompact) {
    return (
      <div className="app-shell h-dvh p-3">
        <header className="glass-surface motion-rise mb-3 flex items-center justify-between px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-muted">WORKSPACE</p>
          <div className="inline-flex rounded-xl border border-[var(--line-soft)] bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setActiveColumn('sidebar')}
              className={`btn-neo px-3 py-1 text-xs ${
                activeColumn === 'sidebar' ? 'border-transparent bg-brand text-white' : 'border-transparent'
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              메뉴
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('list')}
              className={`btn-neo px-3 py-1 text-xs ${
                activeColumn === 'list' ? 'border-transparent bg-brand text-white' : 'border-transparent'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              목록
            </button>
            <button
              type="button"
              onClick={() => setActiveColumn('viewer')}
              className={`btn-neo px-3 py-1 text-xs ${
                activeColumn === 'viewer' ? 'border-transparent bg-brand text-white' : 'border-transparent'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              문서
            </button>
          </div>
        </header>

        <div className="glass-surface h-[calc(100dvh-5.5rem)] overflow-hidden">
          {activeColumn === 'sidebar'
            ? sidebar
            : activeColumn === 'list'
              ? list
              : viewer}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell h-dvh p-4">
      <div className="grid h-full grid-cols-[280px_360px_minmax(0,1fr)] gap-4">
        <aside className="glass-surface overflow-hidden motion-rise">{sidebar}</aside>
        <section className="glass-surface overflow-hidden motion-rise">{list}</section>
        <main className="glass-surface overflow-hidden motion-rise">{viewer}</main>
      </div>
    </div>
  );
}
