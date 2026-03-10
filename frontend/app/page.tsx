'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Mic, NotebookText, Sparkles } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ThreeColumnLayout, useLayout } from '@/components/layout/ThreeColumnLayout';
import { Sidebar, type SidebarTimeFilter } from '@/components/layout/Sidebar';
import { MeetingList } from '@/domains/meeting/components/MeetingList';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { ResultViewer } from '@/domains/result/components/ResultViewer';

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

  const showOnboarding =
    meetingsInfo.total === 0 && !meetingsInfo.isLoading && !meetingsInfo.isSearchApplied && !meetingsInfo.showTrash;

  return (
    <ThreeColumnLayout
      sidebar={
        <Sidebar
          activeTimeFilter={timeFilter}
          activeTag={tagFilter}
          onTimeFilterChange={setTimeFilter}
          onTagChange={setTagFilter}
          showTrash={showTrash}
          onTrashToggle={handleTrashToggle}
          prompts={prompts.map((p) => ({ id: p.id, name: p.name, documentType: p.documentType }))}
        />
      }
      list={
        <MeetingListWithAutoSwitch
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
        />
      }
      viewer={
        selectedMeetingId ? (
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
        ) : showOnboarding ? (
          <OnboardingViewer />
        ) : (
          <EmptyViewer onRefreshList={requestMeetingListRefresh} />
        )
      }
    />
  );
}

/** Wraps MeetingList to auto-switch to viewer tab in compact mode on meeting selection */
function MeetingListWithAutoSwitch({
  onSelectMeeting,
  ...rest
}: React.ComponentProps<typeof MeetingList>) {
  const { setActiveColumn } = useLayout();

  const handleSelectMeeting = (meetingId: string | null) => {
    onSelectMeeting?.(meetingId);
    if (meetingId) {
      setActiveColumn('viewer');
    }
  };

  return <MeetingList {...rest} onSelectMeeting={handleSelectMeeting} />;
}

interface EmptyViewerProps {
  onRefreshList: () => void;
}

function EmptyViewer({ onRefreshList }: EmptyViewerProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="surface-card motion-float w-full max-w-xl p-7">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-brand">
          <NotebookText className="h-3.5 w-3.5" />
          Note-First Workspace
        </div>

        <h2 className="text-2xl font-semibold leading-tight">회의를 선택하면 AI 회의록이 여기에 표시됩니다</h2>
        <p className="mt-2 text-sm text-muted">
          실시간 전사와 작성한 노트를 결합해, 결과를 Markdown 문서로 편집하고 공유할 수 있습니다.
        </p>

        <div className="mt-6 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <div className="surface-card p-3">
            <p className="text-xs font-semibold tracking-wide">BP 01</p>
            <p className="mt-1">회의 중엔 노트 작성에 집중하고, 전사는 접어둔 채 필요할 때만 확인하세요.</p>
          </div>
          <div className="surface-card p-3">
            <p className="text-xs font-semibold tracking-wide">BP 02</p>
            <p className="mt-1">종료 후 프롬프트를 바꿔 같은 회의를 다른 형태로 재생성할 수 있습니다.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/meeting/new"
            className="btn-neo inline-flex border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white"
          >
            <Mic className="h-4 w-4" />
            새 회의 시작
          </Link>
          <button type="button" className="btn-neo inline-flex" onClick={onRefreshList}>
            목록 새로고침
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingViewer() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="surface-card motion-float w-full max-w-xl p-7">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          시작하기
        </div>

        <h2 className="text-2xl font-semibold leading-tight">
          TransNote에 오신 것을 환영합니다
        </h2>
        <p className="mt-2 text-sm text-muted">
          3단계로 첫 AI 회의록을 만들어보세요.
        </p>

        <div className="mt-6 space-y-3">
          <StepCard
            number={1}
            title="새 회의 시작"
            description="제목만 입력하면 바로 시작됩니다. 전사 모드와 언어는 자동 설정됩니다."
          />
          <StepCard
            number={2}
            title="노트 작성"
            description="회의 중 자유롭게 노트를 작성하세요. 3초마다 자동 저장됩니다."
          />
          <StepCard
            number={3}
            title="AI 회의록 확인"
            description="회의 종료 후 노트와 전사를 결합한 AI 회의록이 자동 생성됩니다."
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/meeting/new"
            className="btn-neo inline-flex border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white"
          >
            <Mic className="h-4 w-4" />
            첫 회의 시작하기
          </Link>
          <Link
            href="/landing/guide"
            className="btn-neo inline-flex text-muted"
          >
            <BookOpen className="h-4 w-4" />
            사용 가이드 보기
          </Link>
        </div>
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="surface-card flex items-start gap-3 p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}
