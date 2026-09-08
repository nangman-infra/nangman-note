import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';
import { PROMPT_DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import type { MeetingResult } from '../types/result.types';
import type { ResultPromptOption } from './resultViewerTypes';

interface ResultMarkdownPanelProps {
  result: MeetingResult;
  promptOptions: ResultPromptOption[];
}

export function ResultMarkdownPanel({
  result,
  promptOptions,
}: ResultMarkdownPanelProps) {
  const selectedPrompt = promptOptions.find((prompt) => prompt.id === result.promptId);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-seafoam-deep" strokeWidth={1.75} />
          <span className="tag-dot">AI summary</span>
        </div>
        <article className="result-markdown surface-card p-6 sm:p-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content}</ReactMarkdown>
        </article>
      </div>

      <aside className="flex flex-col gap-4 lg:col-span-4">
        <div className="surface-card p-5">
          <h3 className="label-sm mb-3">Generation</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 whitespace-nowrap text-xs text-[var(--ink-muted)]">생성 시각</dt>
              <dd className="data-mono text-right text-xs font-medium text-[var(--ink-strong)]">
                {new Date(
                  result.metadata?.generatedAt || result.createdAt,
                ).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-[var(--ink-muted)]">전사 단어 수</dt>
              <dd className="data-mono text-xs font-medium text-seafoam-deep">
                {result.metadata.transcriptWordCount.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-[var(--ink-muted)]">노트 길이</dt>
              <dd className="data-mono text-xs font-medium text-seafoam-deep">
                {result.metadata.noteLength.toLocaleString()}자
              </dd>
            </div>
          </dl>
        </div>

        {result.promptId ? (
          <div className="surface-tonal border border-[var(--line-soft)] p-5">
            <h3 className="label-sm mb-2">Prompt</h3>
            <p className="text-sm font-medium text-[var(--ink-strong)]">
              {selectedPrompt?.name ?? result.promptId}
            </p>
            {selectedPrompt ? (
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                {PROMPT_DOCUMENT_TYPE_LABELS[selectedPrompt.documentType]}
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
