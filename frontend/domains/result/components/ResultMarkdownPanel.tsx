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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-electric" strokeWidth={1.5} />
          AI 요약
        </div>
        <article className="result-markdown surface-card p-6 sm:p-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content}</ReactMarkdown>
        </article>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="surface-card p-5">
          <h3 className="label-sm mb-3">생성 정보</h3>
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
              <dd className="data-mono text-xs text-electric">
                {result.metadata.transcriptWordCount.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-[var(--ink-muted)]">노트 길이</dt>
              <dd className="data-mono text-xs text-electric">
                {result.metadata.noteLength.toLocaleString()}자
              </dd>
            </div>
          </dl>
        </div>

        {result.promptId ? (
          <div className="surface-card p-5">
            <h3 className="label-sm mb-2">사용 프롬프트</h3>
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
