'use client';

import { Edit3, Plus, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  PROMPT_DOCUMENT_TYPE_LABELS,
  type Prompt,
} from '@/domains/prompt/types/prompt.types';
import {
  DOCUMENT_TYPE_TILE,
  SETTINGS_FALLBACK_TILE,
  formatUpdatedAt,
} from './settingsPageHelpers';

interface PromptTemplateLibrarySectionProps {
  prompts: Prompt[];
  isLoading: boolean;
  deleteConfirmId: string | null;
  onCreate: () => void;
  onEdit: (prompt: Prompt) => void;
  onDeleteClick: (promptId: string) => void;
}

export function PromptTemplateLibrarySection({
  prompts,
  isLoading,
  deleteConfirmId,
  onCreate,
  onEdit,
  onDeleteClick,
}: PromptTemplateLibrarySectionProps) {
  return (
    <ErrorBoundary>
      <section
        aria-labelledby="system-library-heading"
        className="glass-surface mb-6 p-6 sm:p-8"
      >
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-sm mb-1 text-[var(--ink-muted)]">
              System Library
            </p>
            <h2
              id="system-library-heading"
              className="font-headline text-xl font-bold tracking-tight sm:text-2xl"
            >
              프롬프트 템플릿 라이브러리
            </h2>
            <p className="mt-1 text-xs text-muted">
              기본 타입이 문서 구조를 정하고, 사용자 프롬프트는 추가 강조와
              표현 방식만 덧붙입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={isLoading}
            className="btn-primary inline-flex self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />새 프롬프트
          </button>
        </header>

        {prompts.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-container-low)] p-8 text-center">
            <p className="text-sm text-muted">
              등록된 프롬프트가 없습니다. 새 프롬프트를 만들어보세요.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {prompts.map((prompt) => {
              const tile =
                DOCUMENT_TYPE_TILE[prompt.documentType] ?? SETTINGS_FALLBACK_TILE;
              const TileIcon = tile.icon;
              const description =
                prompt.content ||
                PROMPT_DOCUMENT_TYPE_HELP_TEXT[prompt.documentType];

              return (
                <li
                  key={prompt.id}
                  className="surface-card group relative flex flex-col overflow-hidden p-6"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tile.tone}`}
                    >
                      <TileIcon className="h-5 w-5" />
                    </div>
                    {!prompt.isDefault ? (
                      <button
                        type="button"
                        onClick={() => onDeleteClick(prompt.id)}
                        className="rounded-full p-1.5 text-[var(--ink-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={
                          deleteConfirmId === prompt.id
                            ? '삭제 확인'
                            : '프롬프트 삭제'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <h3 className="font-headline text-lg font-bold leading-snug tracking-tight">
                    {prompt.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-[var(--ink-subtle)]">
                    {description}
                  </p>

                  <div className="mt-auto flex items-end justify-between pt-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="label-sm text-[var(--ink-muted)]">
                        {prompt.isDefault
                          ? '기본 템플릿'
                          : PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]}
                      </span>
                      {!prompt.isDefault && prompt.updatedAt ? (
                        <span className="text-[11px] text-[var(--ink-muted)]">
                          수정 {formatUpdatedAt(prompt.updatedAt)}
                        </span>
                      ) : null}
                    </div>
                    {!prompt.isDefault ? (
                      <button
                        type="button"
                        onClick={() => onEdit(prompt)}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand)] hover:underline"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ErrorBoundary>
  );
}
