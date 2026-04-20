'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock3,
  Mic,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { useUserSettingsStore } from '@/domains/settings/stores/settingsStore';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';

/* ── Language display helpers ── */
const LANGUAGE_LABELS: Record<string, string> = {
  'ko-KR': '한국어',
  'en-US': '영어',
  'ja-JP': '일본어',
  'zh-CN': '중국어',
  'de-DE': '독일어',
  'fr-FR': '프랑스어',
  'es-ES': '스페인어',
};

const TRANSLATE_LABELS: Record<string, string> = {
  ko: '한국어 번역',
  en: '영어 번역',
  ja: '일본어 번역',
  zh: '중국어 번역',
  de: '독일어 번역',
  fr: '프랑스어 번역',
  es: '스페인어 번역',
};

export default function NewMeetingPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const { startMeeting, isLoading, error } = useMeeting();
  const { prompts } = usePrompt();
  const {
    defaultPromptId,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isHydrated: isSettingsHydrated,
    fetchSettings,
  } = useUserSettingsStore();

  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');

  useEffect(() => {
    if (!isSettingsHydrated) {
      void fetchSettings();
    }
  }, [fetchSettings, isSettingsHydrated]);

  /* Resolve prompt — fall back to default if saved ID no longer exists */
  const resolvedPromptId = prompts.some((p) => p.id === defaultPromptId)
    ? defaultPromptId
    : DEFAULT_PROMPT_ID;
  const selectedPrompt = prompts.find((p) => p.id === resolvedPromptId);

  /* ── Build the read-only settings summary line ── */
  const promptLabel = selectedPrompt
    ? formatPromptLabel(selectedPrompt)
    : '회의 (기본)';
  const modeLabel =
    defaultTranscriptionMode === MeetingTranscriptionMode.REALTIME
      ? 'Realtime'
      : 'Batch';
  const langLabel = defaultLanguageCode
    ? (LANGUAGE_LABELS[defaultLanguageCode] ?? defaultLanguageCode)
    : '자동 감지';
  const translateLabel = defaultTranslateTargetLanguage
    ? (TRANSLATE_LABELS[defaultTranslateTargetLanguage] ??
      `${defaultTranslateTargetLanguage} 번역`)
    : '번역 없음';

  const handleStart = async () => {
    if (isLoading) return;

    const meeting = await startMeeting({
      title: title.trim() || undefined,
      agenda: agenda.trim() || undefined,
      promptId: resolvedPromptId,
      transcriptionMode: defaultTranscriptionMode,
      languageCode: defaultLanguageCode || undefined,
      translateTargetLanguage: defaultTranslateTargetLanguage || undefined,
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
    <div className="relative min-h-dvh bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid w-full grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-16">
          {/* ── Left column — Marketing hero (desktop only) ── */}
          <section className="motion-rise hidden flex-col lg:col-span-7 lg:flex">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn-secondary mb-6 inline-flex w-fit text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              워크스페이스로 돌아가기
            </button>

            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold tracking-wide text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Start Session
            </span>

            <h1 className="mt-5 font-headline text-4xl font-extrabold tracking-tight text-[var(--ink-strong)] sm:text-5xl">
              회의를 시작하고
              <br />
              <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-container)] bg-clip-text text-transparent">
                노트를 바로 작성하세요
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--ink-muted)]">
              제목만 입력하면 바로 시작됩니다. 전사 모드, 언어, 번역은 기본
              설정이 자동 적용됩니다.
            </p>

            {/* Feature cards */}
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <FeatureCard
                icon={Clock3}
                title="실시간 기록"
                description="노트 자동 저장 + 전사 수집"
              />
              <FeatureCard
                icon={ShieldCheck}
                title="보안 우선"
                description="녹음 파일 미저장 정책"
              />
              <FeatureCard
                icon={Mic}
                title="빠른 시작"
                description="제목만 입력하면 바로 시작"
              />
            </div>
          </section>

          {/* ── Right column — Form card ── */}
          <aside className="motion-rise lg:col-span-5">
            {/* Mobile-only back button */}
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn-secondary mb-4 inline-flex text-sm lg:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              돌아가기
            </button>

            <div className="rounded-2xl bg-white p-8 shadow-xl sm:p-10">
              {/* Card header */}
              <div className="mb-7">
                <p className="label-sm text-[var(--ink-muted)]">NEW MEETING</p>
                <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--ink-strong)]">
                  회의 시작
                </h2>
              </div>

              {error ? (
                <StatusBanner
                  variant="error"
                  title="회의 시작 준비 실패"
                  message="연결 상태를 확인한 뒤 다시 시도해주세요."
                  className="mb-5"
                />
              ) : null}

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label
                    htmlFor="meeting-title"
                    className="label-sm mb-2 block text-[var(--ink-muted)]"
                  >
                    회의 제목 (선택)
                  </label>
                  <input
                    id="meeting-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 1분기 마케팅 전략 회의"
                    className="input-shell"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                    }}
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    미입력 시 AI가 회의 내용을 기반으로 자동 생성합니다. 완료
                    후 결과 화면에서 수정할 수 있습니다.
                  </p>
                </div>

                {/* Agenda */}
                <div>
                  <label
                    htmlFor="meeting-agenda"
                    className="label-sm mb-2 block text-[var(--ink-muted)]"
                  >
                    회의 아젠다 (선택)
                  </label>
                  <textarea
                    id="meeting-agenda"
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="예: 신규 제품 런칭 전략, 예산 논의"
                    rows={2}
                    className="input-shell w-full resize-none text-sm"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    아젠다가 있으면 회의록 구조화 품질이 좋아집니다.
                  </p>
                </div>

                {/* ── Settings summary tile (read-only, stable height) ── */}
                <div className="rounded-xl bg-[var(--surface-container-low)] px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <Settings2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-[var(--ink-subtle)]">
                        결과 프롬프트:{' '}
                        <span className="font-semibold text-[var(--ink-strong)]">
                          {promptLabel}
                        </span>
                        {' · '}전사:{' '}
                        <span className="font-semibold text-[var(--ink-strong)]">
                          {modeLabel}
                        </span>
                        {' · '}
                        <span className="font-semibold text-[var(--ink-strong)]">
                          {langLabel}
                        </span>
                        {' · '}
                        <span className="font-semibold text-[var(--ink-strong)]">
                          {translateLabel}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/settings')}
                        className="mt-1.5 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                      >
                        설정에서 변경
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary CTA */}
              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isLoading}
                  className="btn-primary inline-flex w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Mic className="h-4 w-4" />
                  {isLoading ? '회의를 준비하는 중...' : '회의 시작'}
                </button>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-[var(--ink-muted)]">
              © 낭만 인프라 · TransNote v1.0
            </p>
          </aside>
        </div>
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
    <article className="rounded-xl bg-[var(--surface-container-low)] p-4 transition hover:bg-[var(--surface-container-high)]">
      <div className="mb-2 inline-flex rounded-full bg-indigo-100 p-2 text-indigo-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--ink-strong)]">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{description}</p>
    </article>
  );
}
