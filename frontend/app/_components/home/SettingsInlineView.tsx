'use client';

import { useEffect, useState } from 'react';
import { Download, LogOut, Mail, Moon, Sun } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import {
  formatPromptLabel,
  type PromptDocumentType,
  usePrompt,
} from '@/domains/prompt';
import { useUserSettingsStore } from '@/domains/settings';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { MeetingTranscriptionMode } from '@/lib/transcription/transcriptionMode';

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

export function SettingsInlineView({ prompts }: SettingsInlineViewProps) {
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
