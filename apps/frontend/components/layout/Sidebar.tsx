'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { FileText, LayoutDashboard, LogOut, Plus, Settings, Sparkles, User } from 'lucide-react';

export type SidebarTimeFilter = 'today' | 'recent' | 'all';
export type SidebarView = 'dashboard' | 'history' | 'prompts' | 'settings';

export interface SidebarPrompt {
  id: string;
  name: string;
  documentType: 'meeting' | 'lecture' | 'mentoring';
}

interface SidebarProps {
  activeTimeFilter?: SidebarTimeFilter;
  activeTag?: string | null;
  onTimeFilterChange?: (filter: SidebarTimeFilter) => void;
  onTagChange?: (promptId: string | null) => void;
  showTrash?: boolean;
  onTrashToggle?: () => void;
  prompts?: SidebarPrompt[];
  /** 현재 활성 뷰 */
  activeView?: SidebarView;
  /** 뷰 전환 콜백 — Settings/Prompts를 오른쪽 메인 영역에서 렌더링 */
  onViewChange?: (view: SidebarView) => void;
}

const NAV_ITEMS: Array<{ key: SidebarView; icon: typeof LayoutDashboard; label: string }> = [
  { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'history', icon: FileText, label: 'Meeting' },
  { key: 'prompts', icon: Sparkles, label: 'Prompts' },
  { key: 'settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({
  activeView = 'dashboard',
  onViewChange,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col p-4">
      {/* Brand Header */}
      <header className="mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-container">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-extrabold leading-none text-indigo-700">
              TransNote
            </h1>
            <p className="label-sm mt-1 text-slate-500">Cognitive Workspace</p>
          </div>
        </div>
      </header>

      {/* Main Navigation — Stitch style: 버튼 기반, 새 페이지 이동 없음 */}
      <nav className="space-y-1">
        <p className="label-sm mb-2 px-4 text-[var(--ink-muted)]">MENU</p>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onViewChange?.(item.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium tracking-wide transition ${
                isActive
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-1 pt-4">
        <UserInfo />
        <Link
          href="/meeting/new"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-4 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:opacity-90 active:scale-95"
          aria-current={pathname === '/meeting/new' ? 'page' : undefined}
        >
          <Plus className="h-5 w-5 text-white" />
          <span className="text-white">New Meeting</span>
        </Link>
      </div>
    </div>
  );
}

function UserInfo() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-container-low)] px-3 py-2.5">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900">
            {session.user.email || '사용자'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
        className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        title="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
