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
  { key: 'dashboard', icon: LayoutDashboard, label: '대시보드' },
  { key: 'history', icon: FileText, label: '회의 기록' },
  { key: 'prompts', icon: Sparkles, label: '프롬프트' },
  { key: 'settings', icon: Settings, label: '설정' },
];

export function Sidebar({
  activeView = 'dashboard',
  onViewChange,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      {/* Brand */}
      <header className="mb-8 px-2">
        <Link href="/" className="flex items-center gap-3 rounded-lg" aria-label="TransNote 홈">
          <BrandMark />
          <div>
            <h1 className="font-headline text-[17px] leading-none text-brand">TransNote</h1>
            <p className="label-sm mt-1.5">AI meeting ledger</p>
          </div>
        </Link>
      </header>

      {/* Navigation */}
      <nav className="space-y-0.5" aria-label="주요 메뉴">
        <p className="label-sm mb-2 px-3">Workspace</p>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onViewChange?.(item.key)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                isActive
                  ? 'bg-brand font-medium text-white shadow-[var(--elevation-button)]'
                  : 'font-normal text-[var(--ink-subtle)] hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-[var(--ink-muted)] group-hover:text-[var(--ink-strong)]'}`}
                strokeWidth={1.75}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto space-y-3 pt-4">
        <UserInfo />
        <Link
          href="/meeting/new"
          className="btn-primary flex w-full"
          aria-current={pathname === '/meeting/new' ? 'page' : undefined}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span>새 회의</span>
        </Link>
      </div>
    </div>
  );
}

/** Indigo Navy square with a seafoam data-point — the "bank built by engineers" mark. */
function BrandMark() {
  return (
    <span
      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand shadow-[var(--elevation-button)]"
      aria-hidden="true"
    >
      <span className="absolute left-[9px] top-[9px] h-[18px] w-[3px] rounded-sm bg-white" />
      <span className="absolute left-[15px] top-[15px] h-[12px] w-[3px] rounded-sm bg-white/70" />
      <span className="absolute left-[21px] top-[21px] h-[6px] w-[6px] rounded-full bg-seafoam" />
    </span>
  );
}

function UserInfo() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="surface-card flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-fixed)] text-brand">
          <User className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[var(--ink-strong)]">
            {session.user.email || '사용자'}
          </p>
          <p className="label-sm mt-0.5 !normal-case !tracking-normal">Signed in</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
        className="btn-icon flex-shrink-0 !p-1.5 hover:!bg-[var(--danger-soft)] hover:!text-[var(--danger)]"
        title="로그아웃"
        aria-label="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
