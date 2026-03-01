'use client';

import Link from 'next/link';
import { CalendarDays, FileClock, FolderKanban, Plus, Settings, Sparkles, Tags, Trash2 } from 'lucide-react';

export type SidebarTimeFilter = 'today' | 'recent' | 'all';

const sections: Array<{
  icon: typeof CalendarDays;
  label: string;
  hint: string;
  filter: SidebarTimeFilter;
}> = [
  { icon: CalendarDays, label: '오늘', hint: '집중 회의', filter: 'today' },
  { icon: FileClock, label: '최근', hint: '마지막 7일', filter: 'recent' },
  { icon: FolderKanban, label: '전체 아카이브', hint: '모든 노트', filter: 'all' },
];

const tags = [
  { name: '회의록', promptId: 'prompt_default_meeting', color: 'bg-teal-100 text-teal-800' },
  { name: '강의', promptId: 'prompt_default_lecture', color: 'bg-amber-100 text-amber-800' },
  { name: '세미나', promptId: 'prompt_default_seminar', color: 'bg-sky-100 text-sky-800' },
];

interface SidebarProps {
  activeTimeFilter?: SidebarTimeFilter;
  activeTag?: string | null;
  onTimeFilterChange?: (filter: SidebarTimeFilter) => void;
  onTagChange?: (promptId: string | null) => void;
}

export function Sidebar({
  activeTimeFilter = 'all',
  activeTag = null,
  onTimeFilterChange,
  onTagChange,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col p-4">
      <header className="surface-card mb-4 p-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          2026 Workspace
        </div>
        <h1 className="text-xl font-semibold leading-tight">TransNote</h1>
        <p className="mt-1 text-xs text-muted">노트 중심 회의 기록 시스템</p>
      </header>

      <nav className="space-y-2">
        {sections.map((item) => {
          const isActive = activeTimeFilter === item.filter;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onTimeFilterChange?.(item.filter)}
              className={`surface-card flex w-full items-center justify-between px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] ${
                isActive ? 'border-brand/40 bg-brand/5' : ''
              }`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <item.icon className={`h-4 w-4 ${isActive ? 'text-brand' : 'text-muted'}`} />
                {item.label}
              </span>
              <span className="text-[11px] text-muted">{item.hint}</span>
            </button>
          );
        })}
      </nav>

      <section className="surface-card mt-4 p-3">
        <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted">
          <Tags className="h-3.5 w-3.5" />
          QUICK TAGS
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const isActive = activeTag === tag.promptId;
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => onTagChange?.(isActive ? null : tag.promptId)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  isActive
                    ? 'ring-2 ring-brand/40 ring-offset-1 ' + tag.color
                    : tag.color + ' opacity-70 hover:opacity-100'
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-auto space-y-2 pt-4">
        <Link href="/settings" className="btn-neo w-full justify-start text-muted">
          <Settings className="h-4 w-4" />
          설정
        </Link>
        <Link href="/?view=trash" className="btn-neo w-full justify-start text-muted">
          <Trash2 className="h-4 w-4" />
          휴지통
        </Link>
        <Link href="/meeting/new" className="btn-neo w-full border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white">
          <Plus className="h-4 w-4" />
          새 회의 시작
        </Link>
      </div>
    </div>
  );
}