'use client';

import { CalendarDays, Search, Settings, Trash2 } from 'lucide-react';

/** 회의 관리 화면 목업 */
export function FlowMockManage() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* 사이드바 + 리스트 2-column */}
      <div className="grid grid-cols-[120px_1fr] divide-x divide-[var(--line-soft)]" style={{ height: 240 }}>
        {/* 미니 사이드바 */}
        <div className="space-y-2 bg-white/40 p-2.5">
          <div className="text-[9px] font-semibold text-brand">TransNote</div>
          <SidebarItem icon={CalendarDays} label="오늘" active />
          <SidebarItem icon={CalendarDays} label="최근" />
          <SidebarItem icon={CalendarDays} label="전체" />
          <div className="mt-2 text-[8px] font-semibold tracking-wide text-muted">TAGS</div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[8px] font-semibold text-teal-800">회의록</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-800">강의</span>
          </div>
          <div className="mt-auto space-y-1 pt-3">
            <SidebarItem icon={Settings} label="설정" />
            <SidebarItem icon={Trash2} label="휴지통" />
          </div>
        </div>

        {/* 회의 리스트 */}
        <div className="flex flex-col">
          {/* 검색 + 필터 */}
          <div className="border-b border-[var(--line-soft)] bg-white/30 px-3 py-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line-soft)] bg-white/80 px-2 py-1.5">
              <Search className="h-3 w-3 text-muted" />
              <span className="text-[10px] text-muted">회의 검색... ⌘K</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              <FilterPill label="전체" active />
              <FilterPill label="진행 중" />
              <FilterPill label="정리 중" />
              <FilterPill label="완료" />
            </div>
          </div>

          {/* 카드 리스트 */}
          <div className="flex-1 space-y-1.5 overflow-hidden p-2">
            <MeetingMiniCard title="주간 정기회의" status="완료" statusColor="bg-teal-100 text-teal-700" time="오늘 · 48분" />
            <MeetingMiniCard title="UX 리서치 강의" status="완료" statusColor="bg-teal-100 text-teal-700" time="어제 · 1시간 22분" />
            <MeetingMiniCard title="시니어 멘토링" status="정리 중" statusColor="bg-amber-100 text-amber-700" time="3/5 · 35분" />
            <MeetingMiniCard title="스프린트 회고" status="완료" statusColor="bg-teal-100 text-teal-700" time="3/3 · 52분" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active = false }: { icon: typeof CalendarDays; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] ${active ? 'bg-brand/10 font-semibold text-brand' : 'text-muted'}`}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${active ? 'bg-brand/10 text-brand' : 'text-muted'}`}>
      {label}
    </span>
  );
}

function MeetingMiniCard({ title, status, statusColor, time }: { title: string; status: string; statusColor: string; time: string }) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold">{title}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${statusColor}`}>{status}</span>
      </div>
      <div className="mt-0.5 text-[9px] text-muted">{time}</div>
    </div>
  );
}
