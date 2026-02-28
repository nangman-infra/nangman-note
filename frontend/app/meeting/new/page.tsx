'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { PromptSelector } from '@/domains/prompt/components/PromptSelector';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { usePromptStore } from '@/domains/prompt/stores/promptStore';

export default function NewMeetingPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const { startMeeting, isLoading, error } = useMeeting();
  const { selectedPromptId } = usePromptStore();
  const [title, setTitle] = useState('');
  const [transcriptionMode, setTranscriptionMode] = useState(
    MeetingTranscriptionMode.BATCH,
  );

  const handleStart = async () => {
    const meeting = await startMeeting({
      title: title.trim() || undefined,
      promptId: selectedPromptId,
      transcriptionMode,
    });

    if (!meeting) {
      pushToast({
        title: '회의 시작에 실패했습니다',
        description: error || '서버 연결 상태를 확인해주세요.',
        variant: 'error',
      });
      return;
    }

    pushToast({
      title: '회의를 시작했습니다',
      description: '실시간 노트 화면으로 이동합니다.',
      variant: 'success',
    });
    router.push(`/meeting/in-progress?meetingId=${meeting.id}`);
  };

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl gap-4 lg:grid-cols-[1fr_460px]">
        <section className="glass-surface motion-rise flex flex-col justify-between p-6 sm:p-8">
          <div>
            <button type="button" onClick={() => router.push('/')} className="btn-neo mb-5 text-xs text-muted">
              <ArrowLeft className="h-3.5 w-3.5" />
              워크스페이스로 돌아가기
            </button>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Start Session
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">회의를 시작하고 노트를 바로 작성하세요</h1>
            <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
              회의 중에는 노트를 중심으로 기록하고, 전사 방식은 배치 또는 실시간으로 선택할 수 있습니다. 종료 후에는
              선택한 프롬프트로 결과를 생성합니다.
            </p>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            <FeatureCard icon={Clock3} title="실시간 기록" description="노트 자동 저장 + 전사 수집" />
            <FeatureCard icon={ShieldCheck} title="보안 우선" description="녹음 파일 미저장 정책" />
            <FeatureCard icon={Mic} title="빠른 시작" description="제목 입력 후 즉시 시작" />
          </div>
        </section>

        <section className="glass-surface motion-rise p-6 sm:p-7">
          <p className="text-xs font-semibold tracking-wide text-muted">NEW MEETING</p>
          <h2 className="mt-1 text-2xl font-semibold">회의 시작 설정</h2>

          {error ? (
            <StatusBanner
              variant="error"
              title="회의 시작 준비 실패"
              message="연결 상태를 확인한 뒤 다시 시도해주세요."
              className="mt-4"
            />
          ) : null}

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="meeting-title" className="mb-2 block text-sm font-medium">
                회의 제목 (선택)
              </label>
              <input
                id="meeting-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 1분기 마케팅 전략 회의"
                className="input-shell"
              />
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium">전사 모드</p>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="전사 모드 선택">
                <label
                  className={`relative block cursor-pointer rounded-[18px] border px-3 py-3 transition ${
                    transcriptionMode === MeetingTranscriptionMode.BATCH
                      ? 'border-brand bg-brand/10 shadow-[0_0_0_2px_rgba(15,118,110,0.12)]'
                      : 'bg-[var(--bg-card)] border-[var(--line-soft)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="transcriptionMode"
                    value={MeetingTranscriptionMode.BATCH}
                    checked={transcriptionMode === MeetingTranscriptionMode.BATCH}
                    onChange={() =>
                      setTranscriptionMode(MeetingTranscriptionMode.BATCH)
                    }
                    className="sr-only"
                  />
                  {transcriptionMode === MeetingTranscriptionMode.BATCH ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      선택됨
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold">Batch (기본)</p>
                  <p className="mt-1 pr-2 text-xs text-muted">
                    회의 종료 후 AWS 배치 전사로 처리합니다. 비용과 안정성이 가장 좋습니다.
                  </p>
                </label>

                <label
                  className={`relative block cursor-pointer rounded-[18px] border px-3 py-3 transition ${
                    transcriptionMode === MeetingTranscriptionMode.REALTIME
                      ? 'border-brand bg-brand/10 shadow-[0_0_0_2px_rgba(15,118,110,0.12)]'
                      : 'bg-[var(--bg-card)] border-[var(--line-soft)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="transcriptionMode"
                    value={MeetingTranscriptionMode.REALTIME}
                    checked={
                      transcriptionMode === MeetingTranscriptionMode.REALTIME
                    }
                    onChange={() =>
                      setTranscriptionMode(MeetingTranscriptionMode.REALTIME)
                    }
                    className="sr-only"
                  />
                  {transcriptionMode === MeetingTranscriptionMode.REALTIME ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      선택됨
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold">Realtime (확장 준비)</p>
                  <p className="mt-1 pr-2 text-xs text-muted">
                    웹소켓 기반 실시간 수집 경로를 활성화합니다. 안정 운영은 Batch 모드를 권장합니다.
                  </p>
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">
                현재 선택:{' '}
                <span className="font-semibold text-foreground">
                  {transcriptionMode === MeetingTranscriptionMode.BATCH
                    ? 'Batch'
                    : 'Realtime'}
                </span>
              </p>
            </div>

            <PromptSelector />

            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="btn-neo w-full border-transparent bg-brand py-3 text-base text-white hover:bg-brand-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Mic className="h-4 w-4" />
              {isLoading ? '회의를 준비하는 중...' : '회의 시작'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <article className="surface-card p-3">
      <div className="mb-2 inline-flex rounded-full bg-brand/10 p-1.5 text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </article>
  );
}
