'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BookOpen, Clock, Mic, Settings, Upload, Users } from 'lucide-react';
import { MeetingList, useMeetings } from '@/domains/meeting';
import type { SidebarTimeFilter, SidebarView } from '@/components/layout/Sidebar';
import { NotificationBell } from './NotificationBell';
import { UploadAudioDialog } from './UploadAudioDialog';

/* ================================================================== */
/* Dashboard View — Stitch "Workspace Overview" style                 */
/* ================================================================== */

interface DashboardViewProps {
  activeView: SidebarView;
  showTrash: boolean;
  onShowTrashChange: (v: boolean) => void;
  refreshToken: number;
  onSelectMeeting: (id: string | null) => void;
  selectedMeetingId?: string;
  timeFilter: SidebarTimeFilter;
  tagFilter: string | null;
  promptFilters: Array<{ id: string; name: string }>;
  onTimeFilterChange: (f: SidebarTimeFilter) => void;
  onTagFilterChange: (t: string | null) => void;
  onMeetingsLoaded: (info: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }) => void;
  meetingsInfo: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean };
  showOnboarding: boolean;
}

export function DashboardView({
  activeView,
  showTrash,
  onShowTrashChange,
  refreshToken,
  onSelectMeeting,
  selectedMeetingId,
  timeFilter,
  tagFilter,
  promptFilters,
  onTimeFilterChange,
  onTagFilterChange,
  onMeetingsLoaded,
  meetingsInfo,
  showOnboarding,
}: DashboardViewProps) {
  const isMeetingManagement = activeView === 'history';
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { fetchMeetings } = useMeetings();
  const { data: session } = useSession();

  const profileInitial = (
    (session?.user?.name?.trim() || session?.user?.email?.trim() || 'U')
      .charAt(0) || 'U'
  ).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* ── Stitch TopAppBar ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-slate-50/80 px-6 py-3 shadow-sm backdrop-blur-xl">
        <h2 className="font-headline text-xl font-bold tracking-tight text-slate-900">
          {isMeetingManagement ? 'Meeting' : 'Workspace Overview'}
        </h2>
        <div className="flex items-center gap-3">
            <NotificationBell onSelectMeeting={onSelectMeeting} />
            <Link href="/settings" className="rounded-full p-2 text-slate-500 transition hover:bg-indigo-50">
              <Settings className="h-5 w-5" />
            </Link>
            {/* Profile Avatar */}
            <div
              className="h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--outline-variant)]/20 bg-indigo-100"
              title={session?.user?.name || session?.user?.email || undefined}
            >
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-indigo-600">
                {profileInitial}
              </div>
            </div>
        </div>
      </header>

      {/* ── Main Content (scrollable) ── */}
      <main className={`scroll-muted flex-1 overflow-y-auto ${isMeetingManagement ? '' : ''}`}>
        {isMeetingManagement ? (
          /* ── Meeting management view: full-height MeetingList ── */
          <div className="flex h-full flex-col bg-white">
            <MeetingListWithAutoSwitch
              variant="history"
              showTrash={showTrash}
              onShowTrashChange={onShowTrashChange}
              refreshToken={refreshToken}
              onSelectMeeting={onSelectMeeting}
              selectedMeetingId={selectedMeetingId}
              timeFilter={timeFilter}
              tagFilter={tagFilter}
              promptFilters={promptFilters}
              onTimeFilterChange={onTimeFilterChange}
              onTagFilterChange={onTagFilterChange}
              onMeetingsLoaded={onMeetingsLoaded}
            />
          </div>
        ) : (
          /* ── Dashboard View: Hero + KPI + MeetingList + Bento ── */
          <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
            {/* ── Hero Bento Grid ── */}
            {!showTrash && (
              <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
                {/* Hero CTA card (8 cols) */}
                <div className="relative overflow-hidden rounded-xl bg-brand-gradient p-8 text-white shadow-xl md:col-span-8 min-h-[260px] flex flex-col justify-between">
                  <div className="relative z-10">
                    <span className="label-sm mb-4 inline-block rounded-full bg-white/20 px-3 py-1">
                      Focus Mode
                    </span>
                    <h1 className="font-headline text-3xl font-extrabold leading-tight tracking-tighter lg:text-4xl">
                      Capture every thought,<br />automatically.
                    </h1>
                    <p className="mt-3 max-w-md text-sm text-white/70 lg:text-base">
                      Your AI partner is ready to transcribe, summarize, and distill your next big meeting into actionable insights.
                    </p>
                  </div>
                  <div className="relative z-10 mt-6 flex gap-4">
                    <Link
                      href="/meeting/new"
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold !text-indigo-700 transition hover:bg-slate-50 active:scale-95"
                    >
                      <Mic className="h-4 w-4" />
                      Start Recording
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowUploadDialog(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-transparent px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Audio
                    </button>
                  </div>
                  {/* Decorative blur blob */}
                  <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-[var(--tertiary-fixed-dim)] opacity-20 blur-[100px]" />
                </div>

                {/* Stat cards (4 cols) */}
                <div className="grid grid-rows-2 gap-6 md:col-span-4">
                  <KpiCards
                    meetingsTotal={meetingsInfo.total}
                    isLoading={meetingsInfo.isLoading}
                  />
                </div>
              </section>
            )}

            {/* ── Onboarding (first-time user) ── */}
            {showOnboarding && (
              <section className="rounded-2xl bg-white p-8 shadow-sm">
                <h3 className="font-headline text-xl font-bold tracking-tight text-slate-900 mb-6">
                  3단계로 시작하세요
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 rounded-xl bg-[var(--surface-container-low)] p-5 transition hover:bg-[var(--surface-container-high)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">1</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">새 회의 시작</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">제목만 입력하면 바로 시작됩니다. 전사 모드와 언어는 자동 설정됩니다.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 rounded-xl bg-[var(--surface-container-low)] p-5 transition hover:bg-[var(--surface-container-high)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">2</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">노트 작성</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">회의 중 자유롭게 노트를 작성하세요. 3초마다 자동 저장됩니다.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 rounded-xl bg-[var(--surface-container-low)] p-5 transition hover:bg-[var(--surface-container-high)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">3</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">AI 회의록 확인</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">회의 종료 후 노트와 전사를 결합한 AI 회의록이 자동 생성됩니다.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Link href="/meeting/new" className="btn-primary inline-flex">
                    <Mic className="h-4 w-4" />
                    첫 회의 시작하기
                  </Link>
                  <Link href="/landing/guide" className="btn-secondary inline-flex">
                    <BookOpen className="h-4 w-4" />
                    사용 가이드
                  </Link>
                </div>
              </section>
            )}

            {/* ── Meeting List — compact archive preview with show-more disclosure ── */}
            {!showOnboarding && (
              <section className="overflow-hidden rounded-2xl bg-white">
                <MeetingListWithAutoSwitch
                  variant="dashboard"
                  showTrash={showTrash}
                  onShowTrashChange={onShowTrashChange}
                  refreshToken={refreshToken}
                  onSelectMeeting={onSelectMeeting}
                  selectedMeetingId={selectedMeetingId}
                  timeFilter={timeFilter}
                  tagFilter={tagFilter}
                  promptFilters={promptFilters}
                  onTimeFilterChange={onTimeFilterChange}
                  onTagFilterChange={onTagFilterChange}
                  onMeetingsLoaded={onMeetingsLoaded}
                />
              </section>
            )}

            {/* ── Bottom Bento: Stats + Promo ── */}
            {!showTrash && (
              <section className="grid grid-cols-1 gap-8 pt-6 md:grid-cols-2">
                {/* Weekly meeting volume */}
                <WeeklyMeetingChart />

                {/* Quick Start Guide Card */}
                <div className="relative overflow-hidden rounded-2xl bg-indigo-900 p-8 text-white">
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div>
                      <BookOpen className="mb-4 h-9 w-9 text-[var(--tertiary-fixed-dim)]" />
                      <h5 className="font-headline text-xl font-bold">빠른 시작 가이드</h5>
                      <p className="mt-2 text-sm leading-relaxed text-indigo-200">
                        3단계로 첫 회의 노트를 만드는 법을 확인하세요. 녹음·노트 작성·AI 회의록 생성까지 한 번에.
                      </p>
                    </div>
                    <Link
                      href="/landing/guide"
                      className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--tertiary)] px-6 py-2 text-sm font-bold text-white transition hover:bg-[var(--tertiary-container)]"
                    >
                      <BookOpen className="h-4 w-4" />
                      가이드 보기
                    </Link>
                  </div>
                  {/* Decorative background pattern */}
                  <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-20">
                    <BookOpen className="h-[120px] w-[120px]" />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <UploadAudioDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUploaded={() => void fetchMeetings({ silent: true })}
      />
    </div>
  );
}

/** Wraps MeetingList — no longer needs column switching */
function MeetingListWithAutoSwitch({
  onSelectMeeting,
  ...rest
}: React.ComponentProps<typeof MeetingList>) {
  const handleSelectMeeting = (meetingId: string | null) => {
    onSelectMeeting?.(meetingId);
  };

  return <MeetingList {...rest} onSelectMeeting={handleSelectMeeting} />;
}

/* ================================================================== */
/* KPI Cards — Total Transcribed hours + Meetings Held count          */
/* ================================================================== */

interface KpiCardsProps {
  /** -1 while initial loading, 0 when no meetings, otherwise total count */
  meetingsTotal: number;
  isLoading: boolean;
}

function KpiCards({ meetingsTotal, isLoading }: KpiCardsProps) {
  const { meetings } = useMeetings();

  const totalTranscribedHours = useMemo(() => {
    let totalMs = 0;
    for (const meeting of meetings) {
      if (!meeting?.startedAt || !meeting?.endedAt) continue;
      const start = new Date(meeting.startedAt).getTime();
      const end = new Date(meeting.endedAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      const delta = end - start;
      if (delta <= 0) continue;
      totalMs += delta;
    }
    return totalMs / (1000 * 60 * 60);
  }, [meetings]);

  const hoursLabel =
    totalTranscribedHours > 0 ? `${totalTranscribedHours.toFixed(1)} hrs` : '—';

  const meetingsLabel = getMeetingsLabel({ isLoading, meetingsTotal });

  return (
    <>
      <div className="flex flex-col justify-between rounded-xl bg-[var(--surface-container-low)] p-6">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--ink-muted)]">Total Transcribed</p>
          <p className="font-headline text-3xl font-bold text-slate-900">{hoursLabel}</p>
        </div>
      </div>
      <div className="flex flex-col justify-between rounded-xl bg-[var(--surface-container-low)] p-6">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-cyan-50/30 p-2 text-[var(--tertiary)]">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--ink-muted)]">Meetings Held</p>
          <p className="font-headline text-3xl font-bold text-slate-900">{meetingsLabel}</p>
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/* Weekly Meeting Chart — aggregates the last 7 days from real data   */
/* ================================================================== */

const WEEKDAY_LABELS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MIN_BAR_PERCENT = 6;

function getMeetingsLabel({
  isLoading,
  meetingsTotal,
}: {
  isLoading: boolean;
  meetingsTotal: number;
}): string {
  if (isLoading || meetingsTotal < 0) {
    return '—';
  }

  return String(meetingsTotal);
}

function getBucketPercent({
  bucketCount,
  hasData,
  maxCount,
}: {
  bucketCount: number;
  hasData: boolean;
  maxCount: number;
}): number {
  if (!hasData || maxCount === 0) {
    return MIN_BAR_PERCENT;
  }

  return Math.max(
    MIN_BAR_PERCENT,
    Math.round((bucketCount / maxCount) * 100),
  );
}

function getBucketFillClass({
  hasData,
  isToday,
}: {
  hasData: boolean;
  isToday: boolean;
}): string {
  if (!hasData) {
    return 'bg-indigo-600/10';
  }

  return isToday ? 'bg-indigo-600' : 'bg-indigo-600/20';
}

function WeeklyMeetingChart() {
  const { meetings } = useMeetings();

  const { buckets, todayIndex, totalInWindow } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const oldestStart = new Date(todayStart.getTime() - 6 * msPerDay);

    const bucketList = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(todayStart.getTime() - (6 - i) * msPerDay);
      return {
        date,
        weekday: date.getDay(),
        count: 0,
      };
    });

    let total = 0;
    for (const meeting of meetings) {
      if (!meeting?.startedAt) continue;
      const started = new Date(meeting.startedAt);
      if (Number.isNaN(started.getTime())) continue;
      if (started < oldestStart) continue;
      const dayStart = new Date(started.getFullYear(), started.getMonth(), started.getDate());
      const diffDays = Math.round((dayStart.getTime() - oldestStart.getTime()) / msPerDay);
      if (diffDays < 0 || diffDays > 6) continue;
      bucketList[diffDays].count += 1;
      total += 1;
    }

    return {
      buckets: bucketList,
      todayIndex: 6,
      totalInWindow: total,
    };
  }, [meetings]);

  const maxCount = buckets.reduce((acc, b) => (b.count > acc ? b.count : acc), 0);
  const hasData = totalInWindow > 0;

  return (
    <div className="rounded-2xl border-l-4 border-indigo-600 bg-[var(--surface-container-high)]/50 p-8">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h5 className="font-headline text-xl font-bold">주간 회의 빈도</h5>
        <span className="label-sm text-[var(--ink-muted)] tracking-widest">
          최근 7일 · {totalInWindow}건
        </span>
      </div>

      <div className="flex h-32 items-end gap-2" aria-hidden={!hasData}>
        {buckets.map((bucket, i) => {
          const isToday = i === todayIndex;
          const percent = getBucketPercent({
            bucketCount: bucket.count,
            hasData,
            maxCount,
          });
          const fillClass = getBucketFillClass({ hasData, isToday });
          return (
            <div
              key={bucket.date.toISOString()}
              className={`w-full rounded-t-lg transition-[height] ${fillClass}`}
              style={{ height: `${percent}%` }}
              title={`${bucket.date.getMonth() + 1}/${bucket.date.getDate()} · ${bucket.count}건`}
            />
          );
        })}
      </div>

      <div className="mt-4 flex justify-between label-sm tracking-widest text-[var(--ink-muted)]">
        {buckets.map((bucket, i) => {
          const isToday = i === todayIndex;
          return (
            <span
              key={`label-${bucket.date.toISOString()}`}
              className={isToday ? 'font-bold text-indigo-600' : ''}
            >
              {WEEKDAY_LABELS_KO[bucket.weekday]}
            </span>
          );
        })}
      </div>

      {!hasData && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">아직 데이터 없음</p>
      )}
    </div>
  );
}
