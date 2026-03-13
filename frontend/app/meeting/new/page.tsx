'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  Mic,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { useMeetingSettingsStore } from '@/domains/meeting/stores/settingsStore';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';
import { PROMPT_DOCUMENT_TYPE_HELP_TEXT } from '@/domains/prompt/types/prompt.types';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';

export default function NewMeetingPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const { startMeeting, isLoading, error } = useMeeting();
  const { prompts, isLoading: isPromptsLoading } = usePrompt();
  const {
    defaultPromptId,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isHydrated: isSettingsHydrated,
    fetchSettings,
  } = useMeetingSettingsStore();

  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasCustomizedSessionDefaults, setHasCustomizedSessionDefaults] =
    useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState(defaultPromptId);
  const [transcriptionMode, setTranscriptionMode] = useState(
    defaultTranscriptionMode,
  );
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode);
  const [translateTargetLanguage, setTranslateTargetLanguage] = useState(
    defaultTranslateTargetLanguage,
  );

  const [showPromptHelp, setShowPromptHelp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('transnote_prompt_help_dismissed');
  });

  useEffect(() => {
    if (!isSettingsHydrated) {
      void fetchSettings();
    }
  }, [fetchSettings, isSettingsHydrated]);

  useEffect(() => {
    if (hasCustomizedSessionDefaults) return;
    setSelectedPromptId(defaultPromptId);
    setTranscriptionMode(defaultTranscriptionMode);
    setLanguageCode(defaultLanguageCode);
    setTranslateTargetLanguage(defaultTranslateTargetLanguage);
  }, [
    defaultLanguageCode,
    defaultPromptId,
    defaultTranscriptionMode,
    defaultTranslateTargetLanguage,
    hasCustomizedSessionDefaults,
  ]);

  const dismissPromptHelp = () => {
    localStorage.setItem('transnote_prompt_help_dismissed', 'true');
    setShowPromptHelp(false);
  };

  const resolvedPromptId = prompts.some((prompt) => prompt.id === selectedPromptId)
    ? selectedPromptId
    : DEFAULT_PROMPT_ID;
  const selectedPrompt = prompts.find((prompt) => prompt.id === resolvedPromptId);

  const handleStart = async () => {
    if (isLoading) return;

    const meeting = await startMeeting({
      title: title.trim() || undefined,
      agenda: agenda.trim() || undefined,
      promptId: resolvedPromptId,
      transcriptionMode,
      languageCode: languageCode || undefined,
      translateTargetLanguage: translateTargetLanguage || undefined,
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
        <section className="glass-surface motion-rise hidden flex-col justify-between p-6 sm:p-8 lg:flex">
          <div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn-neo inline-flex mb-5 text-xs text-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              워크스페이스로 돌아가기
            </button>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Start Session
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              회의를 시작하고 노트를 바로 작성하세요
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
              제목만 입력하면 바로 시작됩니다. 전사 모드, 언어, 번역은 기본 설정이 자동 적용됩니다.
            </p>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3">
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

        <section className="glass-surface motion-rise flex flex-col p-6 sm:p-7">
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-wide text-muted">
              NEW MEETING
            </p>
            <h2 className="mt-1 text-2xl font-semibold">회의 시작</h2>

            {error ? (
              <StatusBanner
                variant="error"
                title="회의 시작 준비 실패"
                message="연결 상태를 확인한 뒤 다시 시도해주세요."
                className="mt-4"
              />
            ) : null}

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="meeting-title"
                  className="mb-1.5 block text-sm font-medium"
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
                <p className="mt-1 text-[11px] text-muted">
                  미입력 시 AI가 회의 내용을 기반으로 자동 생성합니다. 완료 후 결과 화면에서 수정할 수 있습니다.
                </p>
              </div>

              <div>
                <label
                  htmlFor="meeting-agenda"
                  className="mb-1.5 block text-sm font-medium"
                >
                  회의 아젠다 (선택)
                </label>
                <textarea
                  id="meeting-agenda"
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="예: 신규 제품 런칭 전략, 예산 논의"
                  rows={2}
                  className="input-shell w-full resize-y text-sm"
                />
                <p className="mt-1 text-[11px] text-muted">
                  입력하지 않아도 시작할 수 있지만, 아젠다가 있으면 회의록 구조화 품질이 좋아집니다.
                </p>
              </div>

              <div>
                <label
                  htmlFor="prompt-select"
                  className="mb-1.5 block text-sm font-medium"
                >
                  결과 프롬프트
                </label>
                <select
                  id="prompt-select"
                  value={resolvedPromptId}
                  onChange={(e) => {
                    setHasCustomizedSessionDefaults(true);
                    setSelectedPromptId(e.target.value);
                  }}
                  className="input-shell w-full text-sm"
                  disabled={isPromptsLoading}
                >
                  {isPromptsLoading ? (
                    <option value="" disabled>
                      프롬프트 로딩 중...
                    </option>
                  ) : (
                    prompts.map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>
                        {formatPromptLabel(prompt)}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  현재: {selectedPrompt ? formatPromptLabel(selectedPrompt) : '회의 (기본)'}
                  {' · '}
                  <button
                    type="button"
                    onClick={() => router.push('/settings')}
                    className="text-brand hover:underline"
                  >
                    프롬프트 관리
                  </button>
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {selectedPrompt
                    ? `${PROMPT_DOCUMENT_TYPE_HELP_TEXT[selectedPrompt.documentType]} 사용자 프롬프트는 이 기본 구조 위에 추가 강조만 적용됩니다.`
                    : '기본 문서 타입이 결과 구조를 정하고, 사용자 프롬프트는 추가 강조만 적용됩니다.'}
                </p>
                {showPromptHelp ? (
                  <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                    <p className="font-semibold">💡 프롬프트란?</p>
                    <p className="mt-1">
                      AI가 회의록을 작성할 때 사용하는 템플릿입니다.
                      &ldquo;회의록&rdquo;은 안건·결정사항 중심,
                      &ldquo;강의&rdquo;는 핵심 개념·요약 중심,
                      &ldquo;멘토링&rdquo;은 조언·액션아이템 중심으로 정리합니다.
                    </p>
                    <button
                      type="button"
                      onClick={dismissPromptHelp}
                      className="mt-1 text-sky-600 hover:underline"
                    >
                      다시 보지 않기
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[14px] border border-[var(--line-soft)]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                      <Settings2 className="h-3.5 w-3.5" />
                      고급 설정
                    </span>
                    {!showAdvanced ? (
                      <p className="mt-1 truncate text-[11px] text-muted/70">
                        {transcriptionMode === MeetingTranscriptionMode.REALTIME
                          ? 'Realtime'
                          : 'Batch'}
                        {' · '}
                        {languageCode
                          ? {
                              'ko-KR': '한국어',
                              'en-US': '영어',
                              'ja-JP': '일본어',
                              'zh-CN': '중국어',
                              'de-DE': '독일어',
                              'fr-FR': '프랑스어',
                              'es-ES': '스페인어',
                            }[languageCode] ?? languageCode
                          : '자동 감지'}
                        {' · '}
                        {translateTargetLanguage
                          ? {
                              ko: '한국어 번역',
                              en: '영어 번역',
                              ja: '일본어 번역',
                              zh: '중국어 번역',
                              de: '독일어 번역',
                              fr: '프랑스어 번역',
                              es: '스페인어 번역',
                            }[translateTargetLanguage] ??
                            `${translateTargetLanguage} 번역`
                          : '번역 없음'}
                      </p>
                    ) : null}
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted" />
                  )}
                </button>

                {showAdvanced ? (
                  <div className="space-y-3 border-t border-[var(--line-soft)] px-4 py-3">
                    <div>
                      <label
                        htmlFor="transcription-mode"
                        className="mb-1 block text-xs font-medium"
                      >
                        전사 모드
                      </label>
                      <select
                        id="transcription-mode"
                        value={transcriptionMode}
                        onChange={(e) => {
                          setHasCustomizedSessionDefaults(true);
                          setTranscriptionMode(
                            e.target.value as MeetingTranscriptionMode,
                          );
                        }}
                        className="input-shell w-full text-sm"
                      >
                        <option value={MeetingTranscriptionMode.REALTIME}>
                          Realtime (실시간 전사)
                        </option>
                        <option value={MeetingTranscriptionMode.BATCH}>
                          Batch (종료 후 전사)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="language-code"
                        className="mb-1 block text-xs font-medium"
                      >
                        전사 언어
                      </label>
                      <select
                        id="language-code"
                        value={languageCode}
                        onChange={(e) => {
                          setHasCustomizedSessionDefaults(true);
                          setLanguageCode(e.target.value);
                        }}
                        className="input-shell w-full text-sm"
                      >
                        <option value="">자동 감지 (권장)</option>
                        <option value="ko-KR">한국어</option>
                        <option value="en-US">영어</option>
                        <option value="ja-JP">일본어</option>
                        <option value="zh-CN">중국어</option>
                        <option value="de-DE">독일어</option>
                        <option value="fr-FR">프랑스어</option>
                        <option value="es-ES">스페인어</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="translate-target"
                        className="mb-1 block text-xs font-medium"
                      >
                        번역 대상 언어
                      </label>
                      <select
                        id="translate-target"
                        value={translateTargetLanguage}
                        onChange={(e) => {
                          setHasCustomizedSessionDefaults(true);
                          setTranslateTargetLanguage(e.target.value);
                        }}
                        className="input-shell w-full text-sm"
                      >
                        <option value="">번역 안 함</option>
                        <option value="ko">한국어</option>
                        <option value="en">영어</option>
                        <option value="ja">일본어</option>
                        <option value="zh">중국어</option>
                        <option value="de">독일어</option>
                        <option value="fr">프랑스어</option>
                        <option value="es">스페인어</option>
                      </select>
                    </div>

                    <p className="text-[10px] text-muted">
                      기본값은 글로벌 설정에서 변경할 수 있습니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-[var(--line-soft)] bg-[var(--bg-card)] px-6 py-4 sm:-mx-7 sm:-mb-7 sm:px-7">
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="btn-neo inline-flex w-full border-transparent bg-brand py-3 text-base text-white hover:bg-brand-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
