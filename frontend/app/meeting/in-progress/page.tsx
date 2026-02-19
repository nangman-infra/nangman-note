'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mic, Radio, Square, Timer } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { NoteEditor } from '@/domains/note/components/NoteEditor';
import { TranscriptPanel } from '@/domains/transcription/components/TranscriptPanel';
import { useTranscription } from '@/domains/transcription/hooks/useTranscription';
import { formatTime } from '@/lib/utils/date';

export default function InProgressMeetingPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const { currentMeeting, isLoading, error, endMeeting } = useMeeting();
  const [nowTick, setNowTick] = useState(() => Date.now());

  const meetingId = currentMeeting?.id || '';
  const transcriptionMode =
    currentMeeting?.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
  const isRealtimeMode =
    transcriptionMode === MeetingTranscriptionMode.REALTIME;
  const { transcripts, isConnected, error: transcriptionError } = useTranscription(
    meetingId,
    isRealtimeMode,
  );

  useEffect(() => {
    if (!currentMeeting?.startedAt) return;
    const timerId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [currentMeeting?.startedAt]);

  const elapsedSeconds = currentMeeting?.startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(currentMeeting.startedAt).getTime()) / 1000))
    : 0;

  const connectionBadge = !meetingId
    ? { label: '대기', className: 'bg-slate-100 text-slate-700' }
    : !isRealtimeMode
      ? { label: '배치 전사 모드', className: 'bg-slate-100 text-slate-700' }
      : isConnected
      ? { label: '전사 연결됨', className: 'bg-emerald-100 text-emerald-800' }
      : { label: '전사 연결중', className: 'bg-amber-100 text-amber-800' };

  const handleEndMeeting = async () => {
    const success = await endMeeting();
    if (!success) {
      pushToast({
        title: '회의 종료에 실패했습니다',
        description: error || '네트워크 상태를 확인해주세요.',
        variant: 'error',
      });
      return;
    }

    pushToast({
      title: '회의를 종료했습니다',
      description: '결과 확인 화면으로 이동합니다.',
      variant: 'success',
    });
    router.push('/');
  };

  if (!currentMeeting) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center p-6">
        <div className="glass-surface w-full max-w-xl p-7 text-center">
          <h1 className="text-2xl font-semibold">진행 중인 회의가 없습니다</h1>
          <p className="mt-2 text-sm text-muted">새 회의를 시작하면 이 화면에서 노트와 전사를 함께 관리할 수 있습니다.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/" className="btn-neo">
              홈으로 이동
            </Link>
            <Link href="/meeting/new" className="btn-neo border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white">
              새 회의 시작
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-5">
      <div className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-[1400px] flex-col gap-3">
        <header className="glass-surface px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted">LIVE SESSION</p>
              <h1 className="text-xl font-semibold">{currentMeeting.title || '제목 없는 회의'}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connectionBadge.className}`}>
                <Radio className="mr-1 inline-block h-3.5 w-3.5" />
                {connectionBadge.label}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">
                <Timer className="mr-1 inline-block h-3.5 w-3.5" />
                {formatTime(elapsedSeconds)}
              </span>
              <button type="button" onClick={() => router.push('/')} className="btn-neo text-xs text-muted">
                <ArrowLeft className="h-3.5 w-3.5" />
                목록으로
              </button>
              <button
                type="button"
                onClick={handleEndMeeting}
                disabled={isLoading}
                className="btn-neo border-transparent bg-rose-600 px-3 py-2 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                {isLoading ? '종료 중...' : '회의 종료'}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <StatusBanner variant="error" title="회의 상태 오류" message={error} />
        ) : null}
        {isRealtimeMode && transcriptionError ? (
          <StatusBanner
            variant="warning"
            title="전사 연결 불안정"
            message="전사 서버와의 연결이 지연되고 있습니다. 노트는 계속 저장됩니다."
          />
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="glass-surface min-h-0 overflow-hidden">
            <NoteEditor meetingId={currentMeeting.id} />
          </section>

          <aside className="glass-surface min-h-0 overflow-hidden">
            <div className="border-b border-[var(--line-soft)] px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted">TRANSCRIPTION</p>
              <h2 className="mt-1 text-sm font-semibold">
                {isRealtimeMode ? '실시간 전사 모니터' : '배치 전사 대기'}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-white px-2 py-1">
                  세그먼트: {transcripts.length}개
                </span>
                <span className="rounded-full bg-white px-2 py-1">Meeting ID: {currentMeeting.id.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="flex h-[calc(100%-84px)] flex-col">
              <div className="px-4 py-3 text-xs text-muted">
                <Mic className="mr-1 inline-block h-3.5 w-3.5" />
                {isRealtimeMode
                  ? '마이크 입력은 백그라운드 수집되며, 노트에 집중할 수 있도록 전사는 접기/펼치기 방식으로 제공됩니다.'
                  : '현재 회의는 배치 전사 모드입니다. 음성 파일 업로드 후 AWS 배치 전사 잡으로 처리됩니다.'}
              </div>
              {isRealtimeMode ? (
                <TranscriptPanel meetingId={currentMeeting.id} />
              ) : (
                <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted">
                  실시간 전사가 비활성화되어 있습니다. 회의 종료 후 배치 전사를 실행하세요.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
