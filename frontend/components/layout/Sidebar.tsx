'use client';

import Link from 'next/link';
import { Bolt, CalendarDays, FileClock, FolderKanban, Plus, Sparkles, Tags, Trash2 } from 'lucide-react';

const sections = [
  { icon: CalendarDays, label: '오늘', hint: '집중 회의' },
  { icon: FileClock, label: '최근', hint: '마지막 7일' },
  { icon: FolderKanban, label: '전체 아카이브', hint: '모든 노트' },
];

const tags = [
  { name: '회의록', color: 'bg-teal-100 text-teal-800' },
  { name: '강의', color: 'bg-amber-100 text-amber-800' },
  { name: '세미나', color: 'bg-sky-100 text-sky-800' },
];

export function Sidebar() {
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
        {sections.map((item) => (
          <button
            key={item.label}
            type="button"
            className="surface-card flex w-full items-center justify-between px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--line-strong)]"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <item.icon className="h-4 w-4 text-brand" />
              {item.label}
            </span>
            <span className="text-[11px] text-muted">{item.hint}</span>
          </button>
        ))}
      </nav>

      <section className="surface-card mt-4 p-3">
        <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted">
          <Tags className="h-3.5 w-3.5" />
          QUICK TAGS
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button key={tag.name} type="button" className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tag.color}`}>
              {tag.name}
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card mt-4 p-3">
        <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted">
          <Bolt className="h-3.5 w-3.5" />
          NOTE BP
        </p>
        <ul className="space-y-1 text-xs text-muted">
          <li>노트 먼저 작성하고 전사는 보조로 확인</li>
          <li>회의 중단 없이 1클릭 액션 제공</li>
          <li>최종 결과는 편집 가능한 Markdown 유지</li>
        </ul>
      </section>

      <div className="mt-auto space-y-2 pt-4">
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
