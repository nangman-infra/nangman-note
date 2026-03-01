'use client';

import Link from 'next/link';
import { ArrowRight, Mic, NotebookText } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
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
  const { prompts } = usePrompt();

  const requestMeetingListRefresh = () => {
    setMeetingListRefreshToken((prev) => prev + 1);
  };

  return (
    <ThreeColumnLayout
      sidebar={
        <Sidebar
          activeTimeFilter={timeFilter}
          activeTag={tagFilter}
          onTimeFilterChange={setTimeFilter}
          onTagChange={setTagFilter}
        />
      }
      list={
        <MeetingList
          initialShowTrash={initialShowTrash}
          refreshToken={meetingListRefreshToken}
          onSelectMeeting={setSelectedMeetingId}
          selectedMeetingId={selectedMeetingId || undefined}
          timeFilter={timeFilter}
          tagFilter={tagFilter}
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
              isDefault: prompt.isDefault,
            }))}
          />
        ) : (
          <EmptyViewer onRefreshList={requestMeetingListRefresh} />
        )
      }
    />
  );
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
            className="btn-neo border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white"
          >
            <Mic className="h-4 w-4" />
            새 회의 시작
          </Link>
          <button type="button" className="btn-neo" onClick={onRefreshList}>
            목록 새로고침
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
