'use client';

import { useCallback, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { TwoColumnLayout } from '@/components/layout/TwoColumnLayout';
import { Sidebar, type SidebarTimeFilter, type SidebarView } from '@/components/layout/Sidebar';
import { meetingApi, useMeetingStore } from '@/domains/meeting';
import { formatPromptLabel, usePrompt } from '@/domains/prompt';
import { ResultViewer, useResultStore } from '@/domains/result';
import { DashboardView } from './DashboardView';
import { PromptsInlineView } from './PromptsInlineView';
import { SettingsInlineView } from './SettingsInlineView';

interface HomePageContentProps {
  initialShowTrash: boolean;
}

export function HomePageContent({ initialShowTrash }: HomePageContentProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const meetingListRefreshToken = 0;
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

  const handleResultTitleUpdate = useCallback(
    async (meetingId: string, title: string) => {
      try {
        await meetingApi.update(meetingId, { title });
        useResultStore.setState((state) => {
          if (!state.result) return state;
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
                  label: formatPromptLabel(prompt),
                  documentType: prompt.documentType,
                  isDefault: prompt.isDefault,
                }))}
                onTitleUpdate={handleResultTitleUpdate}
              />
            </div>
          </div>
        ) : null
      }
    />
  );
}
