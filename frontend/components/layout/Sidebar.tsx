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
            <h1 className="font-headline text-[17px] leading-none text-foreground">TransNote</h1>
            <p className="label-sm mt-1.5">Meeting automation</p>
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
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                isActive
                  ? 'bg-[var(--surface-container)] text-white shadow-[var(--elevation-sm)]'
                  : 'text-[var(--ink-subtle)] hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="bg-electric-gradient absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full"
                />
              ) : null}
              <item.icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-[var(--ink-muted)] group-hover:text-[var(--ink-strong)]'}`}
                strokeWidth={1.5}
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

/** Workflow-node mark: three connected nodes, the last one lit ember. */
function BrandMark() {
  return (
    <span
      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-container)] shadow-[var(--elevation-sm)]"
      aria-hidden="true"
    >
      <span className="bg-electric-gradient absolute left-[8px] top-[17px] h-[2px] w-[20px] rounded-full opacity-80" />
      <span className="absolute left-[7px] top-[14px] h-2 w-2 rounded-full bg-electric-deep" />
      <span className="absolute left-[15px] top-[14px] h-2 w-2 rounded-full bg-electric-violet" />
      <span className="bg-brand-gradient absolute left-[23px] top-[14px] h-2 w-2 rounded-full shadow-[0_0_8px_rgba(253,137,37,0.8)]" />
    </span>
  );
}

function UserInfo() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="surface-card flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--ink-subtle)]">
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
