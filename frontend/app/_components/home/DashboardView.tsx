'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowRight, ArrowUpRight, BookOpen, Mic, Settings, Upload } from 'lucide-react';
import { MeetingList, useMeetings } from '@/domains/meeting';
import type { SidebarTimeFilter, SidebarView } from '@/components/layout/Sidebar';
import { NotificationBell } from './NotificationBell';
import { UploadAudioDialog } from './UploadAudioDialog';

/* ================================================================== */
/* Dashboard View — n8n "workflow canvas at midnight" register          */
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
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 flex h-[66px] items-center justify-between border-b border-[var(--line-soft)] bg-[var(--bg-elevated)] px-6 backdrop-blur-xl lg:px-8">
        <h2 className="font-headline text-lg text-[var(--ink-strong)]">
          {isMeetingManagement ? '회의 기록' : '워크스페이스'}
        </h2>
        <div className="flex items-center gap-1.5">
          <NotificationBell onSelectMeeting={onSelectMeeting} />
          <Link href="/settings" aria-label="설정" className="btn-icon inline-flex">
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
          <div
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-container)] text-xs text-white shadow-[var(--elevation-sm)]"
            title={session?.user?.name || session?.user?.email || undefined}
          >
            {profileInitial}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="scroll-muted flex-1 overflow-y-auto">
        {isMeetingManagement ? (
          <div className="flex h-full flex-col">
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
          <div className="mx-auto max-w-[1120px] space-y-20 px-6 py-10 lg:px-8 lg:py-16">
            {/* ── Hero: split layout, text left / floating widget right ── */}
            {!showTrash && (
              <section className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                <div className="glow-field glow-field--hero -inset-x-16 -inset-y-12 hidden lg:block" aria-hidden="true" />
                <div className="relative z-10 lg:col-span-6">
                  <h1 className="font-display text-[36px] text-[var(--ink-strong)] sm:text-[44px] lg:text-[52px]">
                    말하는 동안 기록되고,
                    <br />
                    끝나면 회의록이 완성됩니다.
                  </h1>
                  <p className="mt-6 max-w-md text-[16px] font-light leading-relaxed text-[var(--ink-subtle)]">
                    실시간 전사와 노트를 하나의 문서로 결합해, 바로 실행할 수 있는 회의록을 자동으로 정리합니다.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link href="/meeting/new" className="btn-primary inline-flex">
                      <Mic className="h-4 w-4" strokeWidth={1.75} />
                      녹음 시작
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowUploadDialog(true)}
                      className="btn-secondary inline-flex"
                    >
                      <Upload className="h-4 w-4" strokeWidth={1.75} />
                      오디오 업로드
                    </button>
                  </div>
                </div>

                <div className="relative z-10 lg:col-span-6 lg:pl-8">
                  <LiveLedgerWidget meetingsTotal={meetingsInfo.total} isLoading={meetingsInfo.isLoading} />
                </div>
              </section>
            )}

            {/* ── Stats row: electric numbers, steel labels, no dividers ── */}
            {!showTrash && (
              <StatsRow meetingsTotal={meetingsInfo.total} isLoading={meetingsInfo.isLoading} />
            )}

            {/* ── Onboarding (first-time user) ── */}
            {showOnboarding && (
              <section className="surface-card p-6 lg:p-8">
                <h3 className="font-display text-[32px] text-[var(--ink-strong)]">
                  3단계로 첫 회의록을 만드세요
                </h3>
                <ol className="mt-6 grid gap-3 md:grid-cols-3">
                  {ONBOARDING_STEPS.map((step, index) => (
                    <li
                      key={step.title}
                      className="surface-tonal flex items-start gap-4 p-5 !rounded-[12px]"
                    >
                      <span className="data-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-container)] text-xs text-electric shadow-[var(--elevation-sm)]">
                        0{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">{step.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/meeting/new" className="btn-primary inline-flex">
                    <Mic className="h-4 w-4" strokeWidth={1.75} />
                    첫 회의 시작하기
                  </Link>
                  <Link href="/landing/guide" className="btn-secondary inline-flex">
                    <BookOpen className="h-4 w-4" strokeWidth={1.75} />
                    사용 가이드
                  </Link>
                </div>
              </section>
            )}

            {/* ── Meeting List — compact archive preview ── */}
            {!showOnboarding && (
              <section>
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

            {/* ── Bottom: weekly chart + featured (Signal Orange — once per page) ── */}
            {!showTrash && (
              <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <WeeklyMeetingChart />

                <div className="surface-glow relative flex flex-col justify-between overflow-hidden p-6 lg:p-8">
                  <div className="glow-field glow-field--ember-corner" aria-hidden="true" />
                  <div className="relative z-10">
                    <p className="text-sm text-ember-text">빠른 시작 가이드</p>
                    <h5 className="font-display mt-4 text-[28px] text-[var(--ink-strong)]">
                      첫 회의 노트를
                      <br />
                      3단계로 만드는 법
                    </h5>
                    <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-[var(--ink-subtle)]">
                      녹음 · 노트 작성 · AI 회의록 생성까지, 한 번에 따라가는 안내서입니다.
                    </p>
                  </div>
                  <Link href="/landing/guide" className="btn-secondary relative z-10 mt-8 inline-flex w-fit !px-5 !py-2.5">
                    가이드 보기
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                  </Link>
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

const ONBOARDING_STEPS = [
  {
    title: '새 회의 시작',
    description: '제목만 입력하면 바로 시작됩니다. 전사 모드와 언어는 자동 설정됩니다.',
  },
  {
    title: '노트 작성',
    description: '회의 중 자유롭게 노트를 작성하세요. 3초마다 자동 저장됩니다.',
  },
  {
    title: 'AI 회의록 확인',
    description: '회의 종료 후 노트와 전사를 결합한 AI 회의록이 자동 생성됩니다.',
  },
] as const;

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
/* Live Ledger Widget — floating "transaction widget" for the hero    */
/* ================================================================== */

function useMeetingAggregates() {
  const { meetings } = useMeetings();

  return useMemo(() => {
    let totalMs = 0;
    let completed = 0;
    let recording = 0;
    let processing = 0;
    let latest: (typeof meetings)[number] | null = null;

    for (const meeting of meetings) {
      if (!meeting) continue;
      if (meeting.status === 'completed') completed += 1;
      if (meeting.status === 'recording') recording += 1;
      if (meeting.status === 'processing') processing += 1;
      if (meeting.startedAt) {
        if (!latest || new Date(meeting.startedAt) > new Date(latest.startedAt)) {
          latest = meeting;
        }
      }
      if (!meeting.startedAt || !meeting.endedAt) continue;
      const start = new Date(meeting.startedAt).getTime();
      const end = new Date(meeting.endedAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      const delta = end - start;
      if (delta > 0) totalMs += delta;
    }

    return {
      totalHours: totalMs / (1000 * 60 * 60),
      completed,
      recording,
      processing,
      latest,
    };
  }, [meetings]);
}

type LedgerStatus = 'live' | 'processing' | 'idle';

const LEDGER_STATUS_VIEW: Record<LedgerStatus, { label: string; pillClass: string }> = {
  live: { label: '녹음 중', pillClass: 'status-pill--live' },
  processing: { label: '정리 중', pillClass: 'status-pill--warn' },
  idle: { label: '대기', pillClass: 'status-pill--done' },
};

function getLedgerStatus({ recording, processing }: { recording: number; processing: number }): LedgerStatus {
  if (recording > 0) return 'live';
  if (processing > 0) return 'processing';
  return 'idle';
}

function LiveLedgerWidget({ meetingsTotal, isLoading }: { meetingsTotal: number; isLoading: boolean }) {
  const { totalHours, recording, processing, latest } = useMeetingAggregates();
  const hoursLabel = totalHours > 0 ? totalHours.toFixed(1) : '0.0';
  const countLabel = getMeetingsLabel({ isLoading, meetingsTotal });
  const status = getLedgerStatus({ recording, processing });
  const statusView = LEDGER_STATUS_VIEW[status];

  return (
    <div className="surface-widget relative mx-auto w-full max-w-[420px] p-7">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--ink-muted)]">총 전사 시간</p>
        <span className={`status-pill ${statusView.pillClass}`}>{statusView.label}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[56px] text-[var(--ink-strong)]">{hoursLabel}</span>
        <span className="text-base text-[var(--ink-muted)]">시간</span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-[var(--line-soft)] pt-6">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">전체 회의</p>
          <p className="mt-1 text-xl text-[var(--ink-strong)]">{countLabel}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--ink-muted)]">최근 회의</p>
          <p className="mt-1 truncate text-sm text-[var(--ink-subtle)]" title={latest?.title || undefined}>
            {latest?.title || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Stats Row — four columns, electric numerals, no dividers            */
/* ================================================================== */

function StatsRow({ meetingsTotal, isLoading }: { meetingsTotal: number; isLoading: boolean }) {
  const { totalHours, completed, processing } = useMeetingAggregates();
  const hoursLabel = totalHours > 0 ? `${totalHours.toFixed(1)}h` : '—';
  const meetingsLabel = getMeetingsLabel({ isLoading, meetingsTotal });
  const completedLabel = isLoading ? '—' : String(completed);
  const processingLabel = isLoading ? '—' : String(processing);

  const stats = [
    { value: hoursLabel, label: '총 전사 시간' },
    { value: meetingsLabel, label: '전체 회의' },
    { value: completedLabel, label: '완료된 회의록' },
    { value: processingLabel, label: '처리 중' },
  ];

  return (
    <section aria-label="워크스페이스 지표" className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="surface-card px-6 py-5">
          <p className="text-sm text-[var(--ink-muted)]">{stat.label}</p>
          <p className="font-display mt-3 text-[36px] text-[var(--ink-strong)]">{stat.value}</p>
        </div>
      ))}
    </section>
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
    return 'bg-[var(--surface-container)]';
  }

  return isToday ? 'bg-electric-gradient shadow-[0_0_12px_rgba(7,122,199,0.5)]' : 'bg-electric-deep/45';
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
    <div className="surface-card p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <h5 className="font-headline text-[20px] text-[var(--ink-strong)]">주간 회의 빈도</h5>
        <span className="text-sm text-[var(--ink-muted)]">최근 7일 · {totalInWindow}건</span>
      </div>

      <div className="relative flex h-32 items-end gap-2" aria-hidden={!hasData}>
        {/* hairline baseline grid */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--line-soft)]" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--line-soft)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--line-strong)]" />
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
              className={`relative z-10 w-full rounded-t-[2px] transition-[height] ${fillClass}`}
              style={{ height: `${percent}%` }}
              title={`${bucket.date.getMonth() + 1}/${bucket.date.getDate()} · ${bucket.count}건`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-xs text-[var(--ink-muted)]">
        {buckets.map((bucket, i) => {
          const isToday = i === todayIndex;
          return (
            <span
              key={`label-${bucket.date.toISOString()}`}
              className={`w-full text-center ${isToday ? 'text-electric' : ''}`}
            >
              {WEEKDAY_LABELS_KO[bucket.weekday]}
            </span>
          );
        })}
      </div>

      {!hasData && (
        <p className="mt-4 text-xs text-[var(--ink-muted)]">아직 데이터가 없습니다. 첫 회의를 시작하면 여기에 표시됩니다.</p>
      )}
    </div>
  );
}
