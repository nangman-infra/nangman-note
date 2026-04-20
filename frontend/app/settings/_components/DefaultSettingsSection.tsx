'use client';

import { Languages, Mic } from 'lucide-react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import type { Prompt } from '@/domains/prompt/types/prompt.types';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';

interface DefaultSettingsSectionProps {
  prompts: Prompt[];
  resolvedDefaultPromptId: string;
  defaultTranscriptionMode: MeetingTranscriptionMode;
  defaultLanguageCode: string;
  defaultTranslateTargetLanguage: string;
  isPromptLoading: boolean;
  isSettingsLoading: boolean;
  isSettingsSaving: boolean;
  onDefaultPromptChange: (promptId: string) => void;
  onDefaultModeChange: (mode: MeetingTranscriptionMode) => void;
  onDefaultLanguageChange: (languageCode: string) => void;
  onDefaultTranslateLanguageChange: (languageCode: string) => void;
}

export function DefaultSettingsSection({
  prompts,
  resolvedDefaultPromptId,
  defaultTranscriptionMode,
  defaultLanguageCode,
  defaultTranslateTargetLanguage,
  isPromptLoading,
  isSettingsLoading,
  isSettingsSaving,
  onDefaultPromptChange,
  onDefaultModeChange,
  onDefaultLanguageChange,
  onDefaultTranslateLanguageChange,
}: DefaultSettingsSectionProps) {
  const isDefaultPromptDisabled =
    isPromptLoading || isSettingsLoading || isSettingsSaving;
  const isSettingsInputDisabled = isSettingsLoading || isSettingsSaving;

  return (
    <ErrorBoundary>
      <section
        aria-labelledby="template-editor-heading"
        className="glass-surface p-6 sm:p-8"
      >
        <header className="mb-6">
          <p className="label-sm mb-1 text-[var(--ink-muted)]">
            Template Editor
          </p>
          <h2
            id="template-editor-heading"
            className="flex items-center gap-2 font-headline text-xl font-bold tracking-tight sm:text-2xl"
          >
            <Mic className="h-5 w-5 text-[var(--brand)]" />
            기본 설정
          </h2>
          <p className="mt-1 text-xs text-muted">
            여기서 설정한 값은 새 회의 시작 시 자동 적용되고, 회의별로
            개별 override 할 수 있습니다.
          </p>
        </header>

        <p className="mb-6 rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-xs text-[var(--ink-subtle)]">
          💡 이 설정은 사용자 계정 기준으로 저장되며, 같은 계정으로 로그인한
          다른 기기에도 적용됩니다.
        </p>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="default-prompt"
              className="mb-1.5 block text-sm font-medium"
            >
              기본 결과 프롬프트
            </label>
            <select
              id="default-prompt"
              value={resolvedDefaultPromptId}
              onChange={(event) => onDefaultPromptChange(event.target.value)}
              className="input-shell w-full text-sm"
              disabled={isDefaultPromptDisabled}
            >
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {formatPromptLabel(prompt)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              새 회의 화면은 이 프롬프트를 기본값으로 시작하고, 회의별로
              다른 프롬프트를 고를 수 있습니다.
            </p>
          </div>

          <div>
            <label
              htmlFor="default-mode"
              className="mb-1.5 block text-sm font-medium"
            >
              기본 전사 모드
            </label>
            <select
              id="default-mode"
              value={defaultTranscriptionMode}
              onChange={(event) =>
                onDefaultModeChange(event.target.value as MeetingTranscriptionMode)
              }
              className="input-shell w-full text-sm"
              disabled={isSettingsInputDisabled}
            >
              <option value={MeetingTranscriptionMode.REALTIME}>
                Realtime (실시간 전사)
              </option>
              <option value={MeetingTranscriptionMode.BATCH}>
                Batch (종료 후 전사)
              </option>
            </select>
            <p className="mt-1 text-[11px] text-muted">
              새 회의 시작 시 기본으로 적용됩니다. 회의별로 override 가능합니다.
            </p>
          </div>

          <div>
            <label
              htmlFor="default-lang"
              className="mb-1.5 block text-sm font-medium"
            >
              기본 전사 언어
            </label>
            <select
              id="default-lang"
              value={defaultLanguageCode}
              onChange={(event) => onDefaultLanguageChange(event.target.value)}
              className="input-shell w-full text-sm"
              disabled={isSettingsInputDisabled}
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
              htmlFor="default-translate"
              className="mb-1.5 block text-sm font-medium"
            >
              <Languages className="mr-1 inline-block h-4 w-4" />
              기본 번역 대상 언어
            </label>
            <select
              id="default-translate"
              value={defaultTranslateTargetLanguage}
              onChange={(event) =>
                onDefaultTranslateLanguageChange(event.target.value)
              }
              className="input-shell w-full text-sm"
              disabled={isSettingsInputDisabled}
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
            <p className="mt-1 text-[11px] text-muted">
              전사 언어와 다른 언어를 선택하면 실시간 번역이 표시됩니다.
            </p>
          </div>
        </div>
      </section>
    </ErrorBoundary>
  );
}
