'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, LayoutDashboard, Sparkles } from 'lucide-react';
import { TwoColumnLayout } from '@/components/layout/TwoColumnLayout';
import { Sidebar, type SidebarTimeFilter, type SidebarView } from '@/components/layout/Sidebar';
import { meetingApi, useMeetingStore } from '@/domains/meeting';
import { formatPromptLabel, usePrompt } from '@/domains/prompt';
import { ResultViewer, useResultStore } from '@/domains/result';
import { goBack } from '@/lib/navigation/goBack';
import { DashboardView } from './DashboardView';
import { PromptsInlineView } from './PromptsInlineView';
import { SettingsInlineView } from './SettingsInlineView';

/* ------------------------------------------------------------------ */
/* URL model — the URL is the source of truth for the home workspace: */
/*   ?view=history|prompts|settings  (absent = dashboard)             */
/*   ?view=trash                     (history view with trash open)   */
/*   ?meeting=<id>                   (selected meeting viewer)        */
/* ------------------------------------------------------------------ */

function parseActiveView(viewParam: string | null): SidebarView {
  if (viewParam === 'history' || viewParam === 'trash') return 'history';
  if (viewParam === 'prompts' || viewParam === 'settings') return viewParam;
  return 'dashboard';
}

export function buildHomeUrl({
  view,
  showTrash = false,
  meetingId = null,
}: {
  view: SidebarView;
  showTrash?: boolean;
  meetingId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (view === 'history' && showTrash) {
    params.set('view', 'trash');
  } else if (view !== 'dashboard') {
    params.set('view', view);
  }
  if (meetingId) {
    params.set('meeting', meetingId);
  }
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

export function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derived-from-URL state (no duplicated useState) — back/forward simply
  // re-renders with the previous searchParams.
  const viewParam = searchParams.get('view');
  const showTrash = viewParam === 'trash';
  const activeView = parseActiveView(viewParam);
  const selectedMeetingId = searchParams.get('meeting');

  // Mobile pane is derived from the URL as well: the viewer pane is active
  // whenever a meeting is selected or an inline view (prompts/settings) is
  // open. The user can still temporarily override it with the mobile toggle;
  // the override resets on every navigation.
  const derivedMobileView: 'dashboard' | 'viewer' =
    selectedMeetingId || activeView === 'prompts' || activeView === 'settings'
      ? 'viewer'
      : 'dashboard';
  const [mobileViewOverride, setMobileViewOverride] = useState<
    'dashboard' | 'viewer' | null
  >(null);
  const searchParamsKey = searchParams.toString();
  useEffect(() => {
    setMobileViewOverride(null); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchParamsKey]);
  const mobileActiveView = mobileViewOverride ?? derivedMobileView;

  const currentHomeUrl = searchParamsKey ? `/?${searchParamsKey}` : '/';
  /**
   * 동일 URL 재-push 방지: 이미 열린 view/meeting 을 다시 클릭해도
   * 중복 history 항목을 만들지 않는다(Back 이 한 번 무시되는 문제 방지).
   * 모바일에서는 override 만 리셋해 pane 이 다시 열리게 한다.
   */
  const pushHomeUrl = useCallback(
    (url: string) => {
      if (url === currentHomeUrl) {
        setMobileViewOverride(null);
        return;
      }
      router.push(url);
    },
    [currentHomeUrl, router],
  );

  const meetingListRefreshToken = 0;
  const [timeFilter, setTimeFilter] = useState<SidebarTimeFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [meetingsInfo, setMeetingsInfo] = useState<{ total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }>({
    total: -1,
    isLoading: true,
    isSearchApplied: false,
    showTrash: false,
  });
  const { prompts } = usePrompt();
  const promptFilters = useMemo(
    () =>
      prompts.map((prompt) => ({
        id: prompt.id,
        name: formatPromptLabel(prompt),
      })),
    [prompts],
  );

  const handleResultTitleUpdate = useCallback(
    async (meetingId: string, title: string) => {
      try {
        await meetingApi.update(meetingId, { title });
        useResultStore.setState((state) => {
          if (state.result?.meetingId !== meetingId) return state;
          return {
            result: {
              ...state.result,
              metadata: { ...state.result.metadata, title },
            },
          };
        });
        useMeetingStore.setState((state) => ({
          meetings: state.meetings.map((meeting) =>
            meeting.id === meetingId ? { ...meeting, title } : meeting,
          ),
        }));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  /** User-initiated trash toggle — pushes a history entry so Back undoes it. */
  const handleShowTrashChange = useCallback(
    (nextShowTrash: boolean) => {
      pushHomeUrl(
        buildHomeUrl({ view: 'history', showTrash: nextShowTrash, meetingId: null }),
      );
    },
    [pushHomeUrl],
  );

  const handleTrashToggle = () => {
    handleShowTrashChange(!showTrash);
  };

  const handleMeetingsLoaded = useCallback(
    (info: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }) => {
      setMeetingsInfo(info);
    },
    [],
  );

  /**
   * Explicit "back to dashboard" buttons: prefer the real browser history so
   * the previous view (e.g. the history list) is restored; goBack falls back
   * to replace('/') when there is nowhere to go back to (deep link in a
   * fresh tab).
   */
  const handleBackToDashboard = () => {
    goBack(router, '/');
  };

  /**
   * Meeting selection. Selecting pushes `?meeting=<id>` (preserving the view
   * param) so browser Back returns to the list. Clearing (`null`) is only
   * triggered programmatically — e.g. the meeting was deleted or became
   * unavailable — so it replaces instead of pushing a history entry.
   */
  const handleSelectMeeting = useCallback(
    (meetingId: string | null) => {
      if (meetingId) {
        pushHomeUrl(buildHomeUrl({ view: activeView, showTrash, meetingId }));
        return;
      }
      if (selectedMeetingId) {
        router.replace(
          buildHomeUrl({ view: activeView, showTrash, meetingId: null }),
        );
      }
    },
    [activeView, pushHomeUrl, router, selectedMeetingId, showTrash],
  );

  /** Sidebar/mobile navigation — pushes so Back restores the previous view. */
  const handleViewChange = (view: SidebarView) => {
    // Preserve original semantics: switching to dashboard/history clears the
    // selected meeting; prompts/settings keep it (the inline view takes over).
    const keepMeeting = view === 'prompts' || view === 'settings';
    pushHomeUrl(
      buildHomeUrl({
        view,
        showTrash: view === 'history' && showTrash,
        meetingId: keepMeeting ? selectedMeetingId : null,
      }),
    );
  };

  // onboarding: show guided steps when user has zero meetings
  const showOnboarding =
    meetingsInfo.total === 0 && !meetingsInfo.isLoading && !meetingsInfo.isSearchApplied && !meetingsInfo.showTrash;

  // Prompts/settings render their own inline view; otherwise a selected
  // meeting (?meeting=<id> — including deep links) opens the result viewer.
  const showViewer =
    Boolean(selectedMeetingId) && activeView !== 'prompts' && activeView !== 'settings';
  const renderViewer = () => {
    if (activeView === 'settings') {
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--line-soft)] bg-[var(--bg-elevated)] px-6 py-3 backdrop-blur-xl">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="btn-neo inline-flex !px-3 !py-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              대시보드
            </button>
            <span className="text-[var(--ink-faint)]" aria-hidden="true">/</span>
            <span className="text-sm font-medium text-[var(--ink-strong)]">설정</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SettingsInlineView prompts={prompts} />
          </div>
        </div>
      );
    }

    if (activeView === 'prompts') {
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--line-soft)] bg-[var(--bg-elevated)] px-6 py-3 backdrop-blur-xl">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="btn-neo inline-flex !px-3 !py-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              대시보드
            </button>
            <span className="text-[var(--ink-faint)]" aria-hidden="true">/</span>
            <span className="text-sm font-medium text-[var(--ink-strong)]">프롬프트</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PromptsInlineView prompts={prompts} />
          </div>
        </div>
      );
    }

    if (selectedMeetingId) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--line-soft)] bg-[var(--bg-elevated)] px-6 py-3 backdrop-blur-xl">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="btn-neo inline-flex !px-3 !py-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              대시보드
            </button>
            <span className="text-[var(--ink-faint)]" aria-hidden="true">/</span>
            <span className="text-sm font-medium text-[var(--ink-strong)]">회의록</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResultViewer
              key={selectedMeetingId}
              meetingId={selectedMeetingId}
              onMeetingUnavailable={() => handleSelectMeeting(null)}
              promptOptions={prompts.map((prompt) => ({
                id: prompt.id,
                name: prompt.name,
                label: formatPromptLabel(prompt),
                documentType: prompt.documentType,
                isDefault: prompt.isDefault,
              }))}
              onTitleUpdate={handleResultTitleUpdate}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <TwoColumnLayout
      showViewer={showViewer || activeView === 'settings' || activeView === 'prompts'}
      mobileView={mobileActiveView}
      onMobileViewChange={setMobileViewOverride}
      mobileNavigation={
        <nav aria-label="모바일 주요 메뉴" className="grid grid-cols-3 gap-1">
          {([
            ['dashboard', '대시보드', LayoutDashboard],
            ['history', '회의 기록', FileText],
            ['prompts', '프롬프트', Sparkles],
          ] as const).map(([view, label, Icon]) => (
            <button
              key={view}
              type="button"
              onClick={() => handleViewChange(view)}
              aria-current={activeView === view ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition ${
                activeView === view
                  ? 'bg-[var(--surface-container)] text-white'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-container-low)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      }
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
          onShowTrashChange={handleShowTrashChange}
          refreshToken={meetingListRefreshToken}
          onSelectMeeting={handleSelectMeeting}
          selectedMeetingId={selectedMeetingId || undefined}
          timeFilter={timeFilter}
          tagFilter={tagFilter}
          promptFilters={promptFilters}
          onTimeFilterChange={setTimeFilter}
          onTagFilterChange={setTagFilter}
          onMeetingsLoaded={handleMeetingsLoaded}
          meetingsInfo={meetingsInfo}
          showOnboarding={showOnboarding}
        />
      }
      viewer={renderViewer()}
    />
  );
}
