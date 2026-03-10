'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BookOpen, CalendarDays, FileClock, FolderKanban, LogOut, Plus, Settings, Sparkles, Tags, Trash2, User } from 'lucide-react';
import { useMemo } from 'react';
import type { PromptDocumentType } from '@/domains/prompt/types/prompt.types';

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

const DOCUMENT_TYPE_COLORS: Record<PromptDocumentType, string> = {
  meeting: 'bg-teal-100 text-teal-800',
  lecture: 'bg-amber-100 text-amber-800',
  mentoring: 'bg-sky-100 text-sky-800',
};

export interface SidebarPrompt {
  id: string;
  name: string;
  documentType: PromptDocumentType;
}

interface SidebarProps {
  activeTimeFilter?: SidebarTimeFilter;
  activeTag?: string | null;
  onTimeFilterChange?: (filter: SidebarTimeFilter) => void;
  onTagChange?: (promptId: string | null) => void;
  showTrash?: boolean;
  onTrashToggle?: () => void;
  prompts?: SidebarPrompt[];
}

export function Sidebar({
  activeTimeFilter = 'all',
  activeTag = null,
  onTimeFilterChange,
  onTagChange,
  showTrash = false,
  onTrashToggle,
  prompts = [],
}: SidebarProps) {
  const pathname = usePathname();

  const tags = useMemo(
    () =>
      prompts.map((p) => ({
        name: p.name,
        promptId: p.id,
        color: DOCUMENT_TYPE_COLORS[p.documentType] ?? 'bg-teal-100 text-teal-800',
      })),
    [prompts],
  );

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Collapsed sidebar: icon-only, visible at lg (1024-1280px) only     */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden h-full flex-col items-center py-4 lg:flex xl:hidden">
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Sparkles className="h-4 w-4" />
        </div>

        <nav className="space-y-1">
          {sections.map((item) => {
            const isActive = activeTimeFilter === item.filter;
            return (
              <button
                key={item.label}
                type="button"
                title={item.label}
                onClick={() => onTimeFilterChange?.(item.filter)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-brand/5 ${
                  isActive ? 'bg-brand/10 text-brand' : 'text-muted'
                }`}
              >
                <item.icon className="h-5 w-5" />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1">
          <Link
            href="/landing/guide"
            target="_blank"
            title="사용 가이드"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-brand/5"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            title="설정"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-brand/5"
            aria-current={pathname === '/settings' ? 'page' : undefined}
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={onTrashToggle}
            title="휴지통"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-brand/5 ${
              showTrash ? 'bg-rose-50 text-rose-600' : 'text-muted'
            }`}
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <Link
            href="/meeting/new"
            title="새 회의 시작"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-strong"
            aria-current={pathname === '/meeting/new' ? 'page' : undefined}
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full sidebar: visible at xl (1280px+) and in compact mode          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex h-full flex-col p-4 xl:flex lg:hidden">
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
          <UserInfo />
          <Link href="/landing/guide" target="_blank" className="btn-neo inline-flex w-full justify-start text-muted">
            <BookOpen className="h-4 w-4" />
            사용 가이드
          </Link>
          <Link href="/settings" className="btn-neo inline-flex w-full justify-start text-muted" aria-current={pathname === '/settings' ? 'page' : undefined}>
            <Settings className="h-4 w-4" />
            설정
          </Link>
          <button type="button" onClick={onTrashToggle} className={`btn-neo inline-flex w-full justify-start ${showTrash ? 'bg-rose-50 text-rose-600 border-rose-200' : 'text-muted'}`}>
            <Trash2 className="h-4 w-4" />
            휴지통
          </button>
          <Link href="/meeting/new" className="btn-neo inline-flex w-full border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white" aria-current={pathname === '/meeting/new' ? 'page' : undefined}>
            <Plus className="h-4 w-4" />
            새 회의 시작
          </Link>
        </div>
      </div>
    </>
  );
}

function UserInfo() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="surface-card flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{session.user.email || '사용자'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
        className="flex-shrink-0 rounded-md p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600"
        title="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
