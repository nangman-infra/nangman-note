'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bell, BookOpen, Clock, Download, LogOut, Mail, Mic, Moon, NotebookText, Pencil, Search, Settings, Sun, Trash2, Upload, Users } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { TwoColumnLayout, useLayout } from '@/components/layout/TwoColumnLayout';
import { Sidebar, type SidebarTimeFilter, type SidebarView } from '@/components/layout/Sidebar';
import { MeetingList } from '@/domains/meeting/components/MeetingList';
import { useMeetings } from '@/domains/meeting/hooks/useMeeting';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { ResultViewer } from '@/domains/result/components/ResultViewer';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { useUserSettingsStore } from '@/domains/settings/stores/settingsStore';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';
import { PromptEditorDialog } from '@/domains/prompt/components/PromptEditorDialog';
import { PROMPT_DOCUMENT_TYPE_HELP_TEXT, PROMPT_DOCUMENT_TYPE_LABELS, type PromptDocumentType } from '@/domains/prompt/types/prompt.types';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageContent initialShowTrash={false} />}>
      <HomePageWithSearchParams />
    </Suspense>
  );
}

function HomePageWithSearchParams() {
  const searchParams = useSearchParams();
  const initialShowTrash = searchParams.get('view') === 'trash';

  return <HomePageContent initialShowTrash={initialShowTrash} />;
}

interface HomePageContentProps {
  initialShowTrash: boolean;
}

function HomePageContent({ initialShowTrash }: HomePageContentProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingListRefreshToken, setMeetingListRefreshToken] = useState(0);
  const [timeFilter, setTimeFilter] = useState<SidebarTimeFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(initialShowTrash);
  const [activeView, setActiveView] = useState<SidebarView>('dashboard');
  const [meetingsInfo, setMeetingsInfo] = useState<{ total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }>({
    total: -1,
    isLoading: true,
    isSearchApplied: false,
    showTrash: false,
  });
  const { prompts } = usePrompt();

  const requestMeetingListRefresh = () => {
    setMeetingListRefreshToken((prev) => prev + 1);
  };

  const handleTrashToggle = () => {
    setShowTrash((prev) => !prev);
    setSelectedMeetingId(null);
  };

  const handleMeetingsLoaded = useCallback(
    (info: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }) => {
      setMeetingsInfo(info);
    },
    [],
  );

  const handleBackToDashboard = () => {
    setSelectedMeetingId(null);
    setActiveView('dashboard');
  };

  const handleViewChange = (view: SidebarView) => {
    setActiveView(view);
    // dashboard/history 뷰로 전환 시 선택된 회의 해제
    if (view === 'dashboard' || view === 'history') {
      setSelectedMeetingId(null);
    }
  };

  // onboarding: show guided steps when user has zero meetings
  const showOnboarding =
    meetingsInfo.total === 0 && !meetingsInfo.isLoading && !meetingsInfo.isSearchApplied && !meetingsInfo.showTrash;

  // For history/prompts/settings views, we don't show the viewer panel
  const showViewer = Boolean(selectedMeetingId) && activeView !== 'history' && activeView !== 'prompts' && activeView !== 'settings';

  return (
    <TwoColumnLayout
      showViewer={showViewer || activeView === 'settings' || activeView === 'prompts'}
      sidebar={
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          showTrash={showTrash}
          onTrashToggle={handleTrashToggle}
        />
      }
      dashboard={
        <DashboardView
          activeView={activeView}
          showTrash={showTrash}
          onShowTrashChange={setShowTrash}
          refreshToken={meetingListRefreshToken}
          onSelectMeeting={setSelectedMeetingId}
          selectedMeetingId={selectedMeetingId || undefined}
          timeFilter={timeFilter}
          tagFilter={tagFilter}
          onTimeFilterChange={setTimeFilter}
          onTagFilterChange={setTagFilter}
          onMeetingsLoaded={handleMeetingsLoaded}
          meetingsInfo={meetingsInfo}
          showOnboarding={showOnboarding}
          onRefreshList={requestMeetingListRefresh}
        />
      }
      viewer={
        activeView === 'settings' ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 bg-slate-50/80 px-6 py-3 backdrop-blur-xl">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="btn-secondary inline-flex text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
              <span className="text-sm font-semibold text-slate-900">Settings</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SettingsInlineView prompts={prompts} />
            </div>
          </div>
        ) : activeView === 'prompts' ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 bg-slate-50/80 px-6 py-3 backdrop-blur-xl">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="btn-secondary inline-flex text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
              <span className="text-sm font-semibold text-slate-900">Prompts</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PromptsInlineView prompts={prompts} />
            </div>
          </div>
        ) : selectedMeetingId ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-[var(--line-soft)] px-6 py-3">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="btn-secondary inline-flex text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ResultViewer
                key={selectedMeetingId}
                meetingId={selectedMeetingId}
                onMeetingUnavailable={() => setSelectedMeetingId(null)}
                promptOptions={prompts.map((prompt) => ({
                  id: prompt.id,
                  name: prompt.name,
                  documentType: prompt.documentType,
                  isDefault: prompt.isDefault,
                }))}
              />
            </div>
          </div>
        ) : null
      }
    />
  );
}

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
  onTimeFilterChange: (f: SidebarTimeFilter) => void;
  onTagFilterChange: (t: string | null) => void;
  onMeetingsLoaded: (info: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }) => void;
  meetingsInfo: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean };
  showOnboarding: boolean;
  onRefreshList: () => void;
}

function DashboardView({
  activeView,
  showTrash,
  onShowTrashChange,
  refreshToken,
  onSelectMeeting,
  selectedMeetingId,
  timeFilter,
  tagFilter,
  onTimeFilterChange,
  onTagFilterChange,
  onMeetingsLoaded,
  meetingsInfo,
  showOnboarding,
  onRefreshList,
}: DashboardViewProps) {
  const isHistory = activeView === 'history';

  return (
    <div className="flex h-full flex-col">
      {/* ── Stitch TopAppBar ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-slate-50/80 px-6 py-3 shadow-sm backdrop-blur-xl">
        <h2 className="font-headline text-xl font-bold tracking-tight text-slate-900">
          {isHistory ? 'Meeting History' : 'Workspace Overview'}
        </h2>
        <div className="flex items-center gap-3">
            <button type="button" className="rounded-full p-2 text-slate-500 transition hover:bg-indigo-50">
              <Bell className="h-5 w-5" />
            </button>
            <Link href="/settings" className="rounded-full p-2 text-slate-500 transition hover:bg-indigo-50">
              <Settings className="h-5 w-5" />
            </Link>
            {/* Profile Avatar */}
            <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--outline-variant)]/20 bg-indigo-100">
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-indigo-600">
                U
              </div>
            </div>
        </div>
      </header>

      {/* ── Main Content (scrollable) ── */}
      <main className={`scroll-muted flex-1 overflow-y-auto ${isHistory ? '' : ''}`}>
        {isHistory ? (
          /* ── History View: Full-height MeetingList ── */
          <div className="flex h-full flex-col bg-white">
            <MeetingListWithAutoSwitch
              showTrash={showTrash}
              onShowTrashChange={onShowTrashChange}
              refreshToken={refreshToken}
              onSelectMeeting={onSelectMeeting}
              selectedMeetingId={selectedMeetingId}
              timeFilter={timeFilter}
              tagFilter={tagFilter}
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

            {/* ── Meeting List — 고정 높이 영역 (카드 10개 + 헤더 + 더보기 버튼 수용) + 내부 스크롤 ── */}
            {!showOnboarding && (
            <section className="flex h-[1040px] flex-col overflow-hidden rounded-2xl bg-white">
              <MeetingListWithAutoSwitch
                showTrash={showTrash}
                onShowTrashChange={onShowTrashChange}
                refreshToken={refreshToken}
                onSelectMeeting={onSelectMeeting}
                selectedMeetingId={selectedMeetingId}
                timeFilter={timeFilter}
                tagFilter={tagFilter}
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

  const meetingsLabel = isLoading
    ? '—'
    : meetingsTotal < 0
      ? '—'
      : String(meetingsTotal);

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
          const percent = hasData
            ? Math.max(
                MIN_BAR_PERCENT,
                maxCount === 0 ? MIN_BAR_PERCENT : Math.round((bucket.count / maxCount) * 100),
              )
            : MIN_BAR_PERCENT;
          const fillClass = hasData
            ? isToday
              ? 'bg-indigo-600'
              : 'bg-indigo-600/20'
            : 'bg-indigo-600/10';
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

/* ================================================================== */
/* Prompts Inline View — Stitch-based prompt management               */
/* ================================================================== */

interface PromptsInlineViewProps {
  prompts: Array<{
    id: string;
    name: string;
    content: string;
    documentType: PromptDocumentType;
    isDefault?: boolean;
    updatedAt?: string;
  }>;
}

function PromptsInlineView({ prompts }: PromptsInlineViewProps) {
  const { pushToast } = useFeedback();
  const {
    isLoading: isPromptLoading,
    error: promptError,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompt();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editorInitialName, setEditorInitialName] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState('');
  const [editorInitialDocumentType, setEditorInitialDocumentType] = useState<PromptDocumentType>('meeting');
  const [isEditorSaving, setIsEditorSaving] = useState(false);

  // Inline editor state (for the Template Editor section)
  const [inlineName, setInlineName] = useState('');
  const [inlineContent, setInlineContent] = useState('');
  const [inlineDocumentType, setInlineDocumentType] = useState<PromptDocumentType>('meeting');
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [isInlineSaving, setIsInlineSaving] = useState(false);

  const systemPrompts = prompts.filter((p) => p.isDefault);
  const userPrompts = prompts.filter((p) => !p.isDefault);

  const openCreate = () => {
    setInlineEditingId(null);
    setInlineName('');
    setInlineContent('');
    setInlineDocumentType('meeting');
  };

  const openEdit = (prompt: { id: string; name: string; content: string; documentType: PromptDocumentType }) => {
    setInlineEditingId(prompt.id);
    setInlineName(prompt.name);
    setInlineContent(prompt.content);
    setInlineDocumentType(prompt.documentType);
  };

  const handleInlineSave = async () => {
    const trimmedName = inlineName.trim();
    const trimmedContent = inlineContent.trim();
    if (!trimmedName || !trimmedContent) {
      pushToast({ title: '이름과 내용을 모두 입력해주세요', variant: 'error' });
      return;
    }

    setIsInlineSaving(true);
    try {
      if (inlineEditingId) {
        const ok = await updatePrompt(inlineEditingId, { name: trimmedName, content: trimmedContent, documentType: inlineDocumentType });
        if (!ok) { pushToast({ title: '프롬프트 수정 실패', variant: 'error' }); return; }
        pushToast({ title: '프롬프트가 수정되었습니다', variant: 'success' });
      } else {
        const ok = await createPrompt({ name: trimmedName, content: trimmedContent, documentType: inlineDocumentType });
        if (!ok) { pushToast({ title: '프롬프트 생성 실패', variant: 'error' }); return; }
        pushToast({ title: '프롬프트가 생성되었습니다', variant: 'success' });
      }
      setInlineEditingId(null);
      setInlineName('');
      setInlineContent('');
      setInlineDocumentType('meeting');
    } finally {
      setIsInlineSaving(false);
    }
  };

  const handleDelete = async (promptId: string) => {
    const ok = await deletePrompt(promptId);
    if (!ok) {
      pushToast({ title: '프롬프트 삭제 실패', variant: 'error' });
      return;
    }
    pushToast({ title: '프롬프트가 삭제되었습니다', variant: 'success' });
    if (inlineEditingId === promptId) {
      setInlineEditingId(null);
      setInlineName('');
      setInlineContent('');
    }
  };

  /* ─── Inline validation ─── */
  const inlineNameFilled = inlineName.trim().length > 0;
  const inlineContentFilled = inlineContent.trim().length > 0;
  const inlineIsValid = inlineNameFilled && inlineContentFilled;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 lg:p-8">
      {/* ── System Library ── */}
      <ErrorBoundary>
        <section>
          <p className="label-sm mb-2 text-[var(--ink-muted)]">SYSTEM LIBRARY</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">시스템 기본 프롬프트</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {systemPrompts.map((prompt) => (
              <div key={prompt.id} className="rounded-xl bg-[var(--surface-container-low)] p-5 transition hover:bg-[var(--surface-container-high)]">
                <p className="text-sm font-bold text-slate-900">{prompt.name}</p>
                <p className="mt-1.5 line-clamp-2 text-xs text-[var(--ink-muted)]">
                  {prompt.content || PROMPT_DOCUMENT_TYPE_HELP_TEXT[prompt.documentType]}
                </p>
                <p className="mt-3 text-[11px] text-[var(--ink-muted)]">
                  {PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]} · 기본 템플릿
                </p>
              </div>
            ))}
          </div>
        </section>
      </ErrorBoundary>

      {/* ── Template Editor (inline) ── */}
      <ErrorBoundary>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-sm text-[var(--ink-muted)]">TEMPLATE EDITOR</p>
              <h2 className="font-headline text-xl font-bold tracking-tight">
                {inlineEditingId ? '프롬프트 편집' : '새 프롬프트 만들기'}
              </h2>
            </div>
            {inlineEditingId && (
              <button type="button" onClick={openCreate} className="btn-secondary inline-flex text-xs">
                + 새로 만들기
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left 8/12: Editor form */}
            <div className="space-y-4 lg:col-span-8">
              <div>
                <label htmlFor="inline-prompt-name" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  프롬프트 이름
                </label>
                <input
                  id="inline-prompt-name"
                  type="text"
                  value={inlineName}
                  onChange={(e) => setInlineName(e.target.value)}
                  maxLength={100}
                  placeholder="예: 일일 스탠드업"
                  className="input-shell w-full"
                  disabled={isInlineSaving}
                />
              </div>

              <div>
                <label htmlFor="inline-prompt-type" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  기본 문서 타입
                </label>
                <select
                  id="inline-prompt-type"
                  value={inlineDocumentType}
                  onChange={(e) => setInlineDocumentType(e.target.value as PromptDocumentType)}
                  className="input-shell w-full"
                  disabled={isInlineSaving}
                >
                  {Object.entries(PROMPT_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  {PROMPT_DOCUMENT_TYPE_HELP_TEXT[inlineDocumentType]}
                </p>
              </div>

              <div>
                <label htmlFor="inline-prompt-content" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  추가 강조 지시
                </label>
                <textarea
                  id="inline-prompt-content"
                  value={inlineContent}
                  onChange={(e) => setInlineContent(e.target.value)}
                  maxLength={12000}
                  placeholder="예: 실무 팁과 후속 과제를 더 분명하게 정리해줘"
                  rows={8}
                  className="input-shell w-full resize-y font-mono text-sm"
                  disabled={isInlineSaving}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInlineSave}
                  disabled={!inlineIsValid || isInlineSaving}
                  className="btn-primary inline-flex px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isInlineSaving ? '저장 중...' : inlineEditingId ? '저장' : '생성'}
                </button>
                {inlineEditingId && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="btn-secondary inline-flex px-4 py-2 text-xs"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>

            {/* Right 4/12: AI Validation / Tip */}
            <aside className="space-y-4 lg:col-span-4">
              {/* Validation card */}
              <section className="surface-card p-4">
                <header className="mb-3 flex items-center gap-2">
                  <span className="relative inline-flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40 ai-pulse-dot" />
                    <span className="relative h-2 w-2 rounded-full bg-[var(--tertiary)]" />
                  </span>
                  <h4 className="label-sm text-[var(--ink-muted)]">검증</h4>
                </header>
                <ul className="space-y-2 text-xs" role="list">
                  <li className="flex items-start gap-2">
                    <span className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full ${inlineNameFilled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={inlineNameFilled ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}>
                      {inlineNameFilled ? '프롬프트 이름이 입력되었습니다.' : '프롬프트 이름을 입력해주세요.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full ${inlineContentFilled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={inlineContentFilled ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}>
                      {inlineContentFilled ? '강조 지시가 작성되었습니다.' : '강조 지시 내용을 입력해주세요.'}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
                  저장 후 새 회의에서 이 프롬프트를 선택해 실제로 테스트해보세요.
                </p>
              </section>

              {/* AI Tip card */}
              <section className="ai-card-accent rounded-r-xl p-4">
                <header className="mb-3 flex items-center gap-2">
                  <span className="text-[var(--tertiary)]" aria-hidden="true">✦</span>
                  <h4 className="label-sm text-[var(--tertiary)]">AI 작성 팁</h4>
                </header>
                <ul className="space-y-2 text-xs leading-relaxed text-[var(--ink-strong)]" role="list">
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>기본 타입이 문서 구조를 정합니다. 덧붙이는 내용은 강조점과 톤만 조정하세요.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>숫자와 날짜는 원문 그대로 유지하도록 지시하면 정확도가 올라갑니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>항목 순서를 명시하면 결과물이 일관됩니다.</span>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </section>
      </ErrorBoundary>

      {/* ── User Prompts Table ── */}
      <ErrorBoundary>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-sm text-[var(--ink-muted)]">MY PROMPTS</p>
              <h2 className="font-headline text-xl font-bold tracking-tight">개인 등록 프롬프트</h2>
            </div>
            <span className="text-xs text-[var(--ink-muted)]">{userPrompts.length}개</span>
          </div>

          {userPrompts.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-container-low)] p-8 text-center">
              <p className="text-sm text-[var(--ink-muted)]">아직 등록된 프롬프트가 없습니다.</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">위 에디터에서 새 프롬프트를 만들어보세요.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line-soft)] bg-[var(--surface-container-low)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">타입</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">수정일</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--ink-muted)]">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {userPrompts.map((prompt) => (
                    <tr key={prompt.id} className="border-b border-[var(--line-soft)] last:border-b-0 hover:bg-[var(--surface-container-low)] transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{prompt.name}</td>
                      <td className="px-4 py-3 text-[var(--ink-muted)]">{PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]}</td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                        {prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(prompt)}
                            className="rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-50"
                            title="편집"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(prompt.id)}
                            className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </ErrorBoundary>
    </div>
  );
}

/* ================================================================== */
/* Settings Inline View — pure settings, no prompt management         */
/* ================================================================== */

interface SettingsInlineViewProps {
  prompts: Array<{
    id: string;
    name: string;
    content: string;
    documentType: PromptDocumentType;
    isDefault?: boolean;
    updatedAt?: string;
  }>;
}

function SettingsInlineView({ prompts }: SettingsInlineViewProps) {
  const { pushToast } = useFeedback();
  const { data: session } = useSession();
  const {
    defaultPromptId,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isHydrated,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    error: settingsError,
    fetchSettings,
    updateSettings,
  } = useUserSettingsStore();
  const {
    isLoading: isPromptLoading,
  } = usePrompt();

  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (!isHydrated) void fetchSettings();
  }, [fetchSettings, isHydrated]);

  const resolvedDefaultPromptId = prompts.some((p) => p.id === defaultPromptId)
    ? defaultPromptId
    : DEFAULT_PROMPT_ID;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 lg:p-8">
      {/* Transcription Defaults */}
      <ErrorBoundary>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="label-sm text-[var(--ink-muted)]">TRANSCRIPTION</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">기본 전사 설정</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="inline-default-prompt" className="mb-1.5 block text-sm font-medium">기본 결과 프롬프트</label>
              <select
                id="inline-default-prompt"
                value={resolvedDefaultPromptId}
                onChange={async (e) => {
                  const ok = await updateSettings({ defaultPromptId: e.target.value });
                  pushToast({ title: ok ? '기본 프롬프트 변경됨' : '변경 실패', variant: ok ? 'success' : 'error' });
                }}
                className="input-shell w-full text-sm"
                disabled={isPromptLoading || isSettingsLoading || isSettingsSaving}
              >
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{formatPromptLabel(p)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inline-default-mode" className="mb-1.5 block text-sm font-medium">기본 전사 모드</label>
              <select
                id="inline-default-mode"
                value={defaultTranscriptionMode}
                onChange={async (e) => {
                  const ok = await updateSettings({ defaultTranscriptionMode: e.target.value as MeetingTranscriptionMode });
                  pushToast({ title: ok ? '전사 모드 변경됨' : '변경 실패', variant: ok ? 'success' : 'error' });
                }}
                className="input-shell w-full text-sm"
                disabled={isSettingsLoading || isSettingsSaving}
              >
                <option value={MeetingTranscriptionMode.REALTIME}>Realtime (실시간 전사)</option>
                <option value={MeetingTranscriptionMode.BATCH}>Batch (종료 후 전사)</option>
              </select>
            </div>
            <div>
              <label htmlFor="inline-default-lang" className="mb-1.5 block text-sm font-medium">기본 언어</label>
              <select
                id="inline-default-lang"
                value={defaultLanguageCode || 'ko-KR'}
                onChange={async (e) => {
                  const ok = await updateSettings({ defaultLanguageCode: e.target.value });
                  pushToast({ title: ok ? '언어 변경됨' : '변경 실패', variant: ok ? 'success' : 'error' });
                }}
                className="input-shell w-full text-sm"
                disabled={isSettingsLoading || isSettingsSaving}
              >
                <option value="ko-KR">한국어</option>
                <option value="en-US">English</option>
                <option value="ja-JP">日本語</option>
              </select>
            </div>
            <div>
              <label htmlFor="inline-translate-lang" className="mb-1.5 block text-sm font-medium">번역 대상 언어</label>
              <select
                id="inline-translate-lang"
                value={defaultTranslateTargetLanguage || ''}
                onChange={async (e) => {
                  const ok = await updateSettings({ defaultTranslateTargetLanguage: e.target.value || undefined });
                  pushToast({ title: ok ? '번역 설정 변경됨' : '변경 실패', variant: ok ? 'success' : 'error' });
                }}
                className="input-shell w-full text-sm"
                disabled={isSettingsLoading || isSettingsSaving}
              >
                <option value="">번역 안 함</option>
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </div>
        </section>
      </ErrorBoundary>

      {/* Theme */}
      <ErrorBoundary>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="label-sm text-[var(--ink-muted)]">APPEARANCE</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">테마</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {themeMode === 'light' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-400" />}
              <span className="text-sm font-medium">{themeMode === 'light' ? '라이트 모드' : '다크 모드'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setThemeMode((prev) => prev === 'light' ? 'dark' : 'light');
                pushToast({ title: '테마 설정은 추후 지원 예정입니다', variant: 'info' });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                themeMode === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                themeMode === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </section>
      </ErrorBoundary>

      {/* Notifications */}
      <ErrorBoundary>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="label-sm text-[var(--ink-muted)]">NOTIFICATIONS</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">알림</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">회의 완료 알림</p>
              <p className="text-xs text-[var(--ink-muted)]">AI 회의록 생성이 완료되면 알림을 받습니다</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotificationsEnabled((prev) => !prev);
                pushToast({ title: '알림 설정은 추후 지원 예정입니다', variant: 'info' });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </section>
      </ErrorBoundary>

      {/* Data */}
      <ErrorBoundary>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="label-sm text-[var(--ink-muted)]">DATA</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">데이터</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">전체 회의 내보내기</p>
              <p className="text-xs text-[var(--ink-muted)]">모든 회의 데이터를 JSON 형식으로 내보냅니다</p>
            </div>
            <button
              type="button"
              onClick={() => pushToast({ title: '내보내기 기능은 추후 지원 예정입니다', variant: 'info' })}
              className="btn-secondary inline-flex text-sm"
            >
              <Download className="h-4 w-4" />
              내보내기
            </button>
          </div>
        </section>
      </ErrorBoundary>

      {/* Account */}
      <ErrorBoundary>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="label-sm text-[var(--ink-muted)]">ACCOUNT</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">계정</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[var(--ink-muted)]" />
              <span className="text-sm text-slate-900">{session?.user?.email || '이메일 없음'}</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </section>
      </ErrorBoundary>
    </div>
  );
}
