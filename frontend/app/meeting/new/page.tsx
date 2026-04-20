'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { MeetingTranscriptionMode, useMeeting } from '@/domains/meeting';
import { formatPromptLabel, usePrompt } from '@/domains/prompt';
import { useUserSettingsStore } from '@/domains/settings';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { NewMeetingForm } from './_components/NewMeetingForm';
import { NewMeetingHero } from './_components/NewMeetingHero';
import {
  getLanguageLabel,
  getTranslateLabel,
} from './_components/meetingSettingLabels';

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
  const langLabel = getLanguageLabel(defaultLanguageCode);
  const translateLabel = getTranslateLabel(defaultTranslateTargetLanguage);

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
          <NewMeetingHero onBack={() => router.push('/')} />
          <NewMeetingForm
            title={title}
            agenda={agenda}
            promptLabel={promptLabel}
            modeLabel={modeLabel}
            languageLabel={langLabel}
            translateLabel={translateLabel}
            isLoading={isLoading}
            error={error}
            onTitleChange={setTitle}
            onAgendaChange={setAgenda}
            onBack={() => router.push('/')}
            onOpenSettings={() => router.push('/settings')}
            onStart={handleStart}
          />
        </div>
      </div>
    </div>
  );
}
