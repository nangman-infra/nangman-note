import { AlertCircle, Check, Sparkles } from 'lucide-react';
import {
  AI_WRITING_TIPS,
  getContentValidationLabel,
  getNameValidationLabel,
} from './promptEditorConfig';

interface PromptEditorSidebarProps {
  nameFilled: boolean;
  contentFilled: boolean;
  nameWithinLimit: boolean;
  contentWithinLimit: boolean;
  trimmedContentLength: number;
}

export function PromptEditorSidebar({
  nameFilled,
  contentFilled,
  nameWithinLimit,
  contentWithinLimit,
  trimmedContentLength,
}: PromptEditorSidebarProps) {
  return (
    <aside className="space-y-4 lg:col-span-4">
      <section
        aria-labelledby="prompt-validation-heading"
        className="surface-card p-4"
      >
        <header className="mb-3 flex items-center gap-2">
          <span
            className="relative inline-flex h-2 w-2 items-center justify-center"
            aria-hidden="true"
          >
            <span className="absolute inset-0 rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40 ai-pulse-dot" />
            <span className="relative h-2 w-2 rounded-full bg-[var(--tertiary)]" />
          </span>
          <h4
            id="prompt-validation-heading"
            className="label-sm text-[var(--ink-muted)]"
          >
            검증
          </h4>
        </header>

        <ul className="space-y-2 text-xs" role="list">
          <ValidationRow
            ok={nameFilled && nameWithinLimit}
            label={getNameValidationLabel({ nameFilled, nameWithinLimit })}
          />
          <ValidationRow
            ok={contentFilled && contentWithinLimit}
            label={getContentValidationLabel({
              contentFilled,
              contentWithinLimit,
              trimmedContentLength,
            })}
          />
        </ul>

        <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
          저장 후 새 회의에서 이 프롬프트를 선택해 실제로 테스트해보세요.
        </p>
      </section>

      <section
        aria-labelledby="prompt-ai-tip-heading"
        className="ai-card-accent rounded-r-xl p-4"
      >
        <header className="mb-3 flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 text-[var(--tertiary)]"
            aria-hidden="true"
          />
          <h4 id="prompt-ai-tip-heading" className="label-sm text-[var(--tertiary)]">
            AI 작성 팁
          </h4>
        </header>

        <ul
          className="space-y-2 text-xs leading-relaxed text-[var(--ink-strong)]"
          role="list"
        >
          {AI_WRITING_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span
                className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600"
          aria-hidden="true"
        />
      ) : (
        <AlertCircle
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500"
          aria-hidden="true"
        />
      )}
      <span
        className={ok ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}
      >
        {label}
      </span>
    </li>
  );
}
