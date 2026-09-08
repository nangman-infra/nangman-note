'use client';

import { ArrowLeft, Mic, Settings2 } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';

interface NewMeetingFormProps {
  title: string;
  agenda: string;
  promptLabel: string;
  modeLabel: string;
  languageLabel: string;
  translateLabel: string;
  isLoading: boolean;
  error?: string | null;
  onTitleChange: (value: string) => void;
  onAgendaChange: (value: string) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onStart: () => void;
}

export function NewMeetingForm({
  title,
  agenda,
  promptLabel,
  modeLabel,
  languageLabel,
  translateLabel,
  isLoading,
  error,
  onTitleChange,
  onAgendaChange,
  onBack,
  onOpenSettings,
  onStart,
}: NewMeetingFormProps) {
  return (
    <aside className="motion-rise lg:col-span-5">
      <button
        type="button"
        onClick={onBack}
        className="btn-neo mb-4 inline-flex !px-3 !py-1.5 text-xs lg:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        돌아가기
      </button>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isLoading) onStart();
        }}
        aria-busy={isLoading}
        className="surface-product p-8 sm:p-10"
      >
        <div className="mb-7">
          <p className="label-sm">New meeting</p>
          <h2 className="font-headline mt-1.5 text-2xl text-[var(--ink-strong)]">
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
          <div>
            <label
              htmlFor="meeting-title"
              className="mb-2 block text-xs font-medium text-[var(--ink-subtle)]"
            >
              회의 제목 (선택)
            </label>
            <input
              id="meeting-title"
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="예: 1분기 마케팅 전략 회의"
              className="input-shell"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              미입력 시 AI가 회의 내용을 기반으로 자동 생성합니다. 완료 후 결과
              화면에서 수정할 수 있습니다.
            </p>
          </div>

          <div>
            <label
              htmlFor="meeting-agenda"
              className="mb-2 block text-xs font-medium text-[var(--ink-subtle)]"
            >
              회의 아젠다 (선택)
            </label>
            <textarea
              id="meeting-agenda"
              value={agenda}
              onChange={(event) => onAgendaChange(event.target.value)}
              placeholder="예: 신규 제품 런칭 전략, 예산 논의"
              rows={2}
              className="input-shell w-full resize-none text-sm"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              아젠다가 있으면 회의록 구조화 품질이 좋아집니다.
            </p>
          </div>

          <div className="surface-tonal border border-[var(--line-soft)] px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <Settings2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-muted)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-[var(--ink-subtle)]">
                  결과 프롬프트:{' '}
                  <span className="font-medium text-[var(--ink-strong)]">
                    {promptLabel}
                  </span>
                  {' · '}전사:{' '}
                  <span className="font-medium text-[var(--ink-strong)]">
                    {modeLabel}
                  </span>
                  {' · '}
                  <span className="font-medium text-[var(--ink-strong)]">
                    {languageLabel}
                  </span>
                  {' · '}
                  <span className="font-medium text-[var(--ink-strong)]">
                    {translateLabel}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="mt-1.5 text-[11px] font-medium text-brand hover:underline"
                >
                  설정에서 변경
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary inline-flex w-full !py-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mic className="h-4 w-4" />
            {isLoading ? '회의를 준비하는 중...' : '회의 시작'}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-[11px] text-[var(--ink-muted)]">
        © 낭만 인프라 · TransNote v1.0
      </p>
    </aside>
  );
}
