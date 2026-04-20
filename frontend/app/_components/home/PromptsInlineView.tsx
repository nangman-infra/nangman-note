'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  PROMPT_DOCUMENT_TYPE_LABELS,
  type PromptDocumentType,
  usePrompt,
} from '@/domains/prompt';

/* ================================================================== */
/* Prompts Inline View — Stitch-based prompt management               */
/* ================================================================== */

interface PromptsInlineViewProps {
  prompts: Array<{
    id: string;
    name: string;
    content: string;
    documentType: PromptDocumentType;
    isDefault?: boolean;
    updatedAt?: string;
  }>;
}

export function PromptsInlineView({ prompts }: PromptsInlineViewProps) {
  const { pushToast } = useFeedback();
  const {
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompt();

  // Inline editor state (for the Template Editor section)
  const [inlineName, setInlineName] = useState('');
  const [inlineContent, setInlineContent] = useState('');
  const [inlineDocumentType, setInlineDocumentType] = useState<PromptDocumentType>('meeting');
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [isInlineSaving, setIsInlineSaving] = useState(false);

  const systemPrompts = prompts.filter((p) => p.isDefault);
  const userPrompts = prompts.filter((p) => !p.isDefault);

  const openCreate = () => {
    setInlineEditingId(null);
    setInlineName('');
    setInlineContent('');
    setInlineDocumentType('meeting');
  };

  const openEdit = (prompt: { id: string; name: string; content: string; documentType: PromptDocumentType }) => {
    setInlineEditingId(prompt.id);
    setInlineName(prompt.name);
    setInlineContent(prompt.content);
    setInlineDocumentType(prompt.documentType);
  };

  const handleInlineSave = async () => {
    const trimmedName = inlineName.trim();
    const trimmedContent = inlineContent.trim();
    if (!trimmedName || !trimmedContent) {
      pushToast({ title: '이름과 내용을 모두 입력해주세요', variant: 'error' });
      return;
    }

    setIsInlineSaving(true);
    try {
      if (inlineEditingId) {
        const ok = await updatePrompt(inlineEditingId, { name: trimmedName, content: trimmedContent, documentType: inlineDocumentType });
        if (!ok) { pushToast({ title: '프롬프트 수정 실패', variant: 'error' }); return; }
        pushToast({ title: '프롬프트가 수정되었습니다', variant: 'success' });
      } else {
        const ok = await createPrompt({ name: trimmedName, content: trimmedContent, documentType: inlineDocumentType });
        if (!ok) { pushToast({ title: '프롬프트 생성 실패', variant: 'error' }); return; }
        pushToast({ title: '프롬프트가 생성되었습니다', variant: 'success' });
      }
      setInlineEditingId(null);
      setInlineName('');
      setInlineContent('');
      setInlineDocumentType('meeting');
    } finally {
      setIsInlineSaving(false);
    }
  };

  const handleDelete = async (promptId: string) => {
    const ok = await deletePrompt(promptId);
    if (!ok) {
      pushToast({ title: '프롬프트 삭제 실패', variant: 'error' });
      return;
    }
    pushToast({ title: '프롬프트가 삭제되었습니다', variant: 'success' });
    if (inlineEditingId === promptId) {
      setInlineEditingId(null);
      setInlineName('');
      setInlineContent('');
    }
  };

  /* ─── Inline validation ─── */
  const inlineNameFilled = inlineName.trim().length > 0;
  const inlineContentFilled = inlineContent.trim().length > 0;
  const inlineIsValid = inlineNameFilled && inlineContentFilled;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 lg:p-8">
      {/* ── System Library ── */}
      <ErrorBoundary>
        <section>
          <p className="label-sm mb-2 text-[var(--ink-muted)]">SYSTEM LIBRARY</p>
          <h2 className="mb-4 font-headline text-xl font-bold tracking-tight">시스템 기본 프롬프트</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {systemPrompts.map((prompt) => (
              <div key={prompt.id} className="rounded-xl bg-[var(--surface-container-low)] p-5 transition hover:bg-[var(--surface-container-high)]">
                <p className="text-sm font-bold text-slate-900">{prompt.name}</p>
                <p className="mt-1.5 line-clamp-2 text-xs text-[var(--ink-muted)]">
                  {prompt.content || PROMPT_DOCUMENT_TYPE_HELP_TEXT[prompt.documentType]}
                </p>
                <p className="mt-3 text-[11px] text-[var(--ink-muted)]">
                  {PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]} · 기본 템플릿
                </p>
              </div>
            ))}
          </div>
        </section>
      </ErrorBoundary>

      {/* ── Template Editor (inline) ── */}
      <ErrorBoundary>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-sm text-[var(--ink-muted)]">TEMPLATE EDITOR</p>
              <h2 className="font-headline text-xl font-bold tracking-tight">
                {inlineEditingId ? '프롬프트 편집' : '새 프롬프트 만들기'}
              </h2>
            </div>
            {inlineEditingId && (
              <button type="button" onClick={openCreate} className="btn-secondary inline-flex text-xs">
                + 새로 만들기
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left 8/12: Editor form */}
            <div className="space-y-4 lg:col-span-8">
              <div>
                <label htmlFor="inline-prompt-name" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  프롬프트 이름
                </label>
                <input
                  id="inline-prompt-name"
                  type="text"
                  value={inlineName}
                  onChange={(e) => setInlineName(e.target.value)}
                  maxLength={100}
                  placeholder="예: 일일 스탠드업"
                  className="input-shell w-full"
                  disabled={isInlineSaving}
                />
              </div>

              <div>
                <label htmlFor="inline-prompt-type" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  기본 문서 타입
                </label>
                <select
                  id="inline-prompt-type"
                  value={inlineDocumentType}
                  onChange={(e) => setInlineDocumentType(e.target.value as PromptDocumentType)}
                  className="input-shell w-full"
                  disabled={isInlineSaving}
                >
                  {Object.entries(PROMPT_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  {PROMPT_DOCUMENT_TYPE_HELP_TEXT[inlineDocumentType]}
                </p>
              </div>

              <div>
                <label htmlFor="inline-prompt-content" className="label-sm mb-1.5 block text-[var(--ink-muted)]">
                  추가 강조 지시
                </label>
                <textarea
                  id="inline-prompt-content"
                  value={inlineContent}
                  onChange={(e) => setInlineContent(e.target.value)}
                  maxLength={12000}
                  placeholder="예: 실무 팁과 후속 과제를 더 분명하게 정리해줘"
                  rows={8}
                  className="input-shell w-full resize-y font-mono text-sm"
                  disabled={isInlineSaving}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInlineSave}
                  disabled={!inlineIsValid || isInlineSaving}
                  className="btn-primary inline-flex px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isInlineSaving ? '저장 중...' : inlineEditingId ? '저장' : '생성'}
                </button>
                {inlineEditingId && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="btn-secondary inline-flex px-4 py-2 text-xs"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>

            {/* Right 4/12: AI Validation / Tip */}
            <aside className="space-y-4 lg:col-span-4">
              {/* Validation card */}
              <section className="surface-card p-4">
                <header className="mb-3 flex items-center gap-2">
                  <span className="relative inline-flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40 ai-pulse-dot" />
                    <span className="relative h-2 w-2 rounded-full bg-[var(--tertiary)]" />
                  </span>
                  <h4 className="label-sm text-[var(--ink-muted)]">검증</h4>
                </header>
                <ul className="space-y-2 text-xs" role="list">
                  <li className="flex items-start gap-2">
                    <span className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full ${inlineNameFilled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={inlineNameFilled ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}>
                      {inlineNameFilled ? '프롬프트 이름이 입력되었습니다.' : '프롬프트 이름을 입력해주세요.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full ${inlineContentFilled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={inlineContentFilled ? 'text-[var(--ink-subtle)]' : 'text-[var(--ink-strong)]'}>
                      {inlineContentFilled ? '강조 지시가 작성되었습니다.' : '강조 지시 내용을 입력해주세요.'}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
                  저장 후 새 회의에서 이 프롬프트를 선택해 실제로 테스트해보세요.
                </p>
              </section>

              {/* AI Tip card */}
              <section className="ai-card-accent rounded-r-xl p-4">
                <header className="mb-3 flex items-center gap-2">
                  <span className="text-[var(--tertiary)]" aria-hidden="true">✦</span>
                  <h4 className="label-sm text-[var(--tertiary)]">AI 작성 팁</h4>
                </header>
                <ul className="space-y-2 text-xs leading-relaxed text-[var(--ink-strong)]" role="list">
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>기본 타입이 문서 구조를 정합니다. 덧붙이는 내용은 강조점과 톤만 조정하세요.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>숫자와 날짜는 원문 그대로 유지하도록 지시하면 정확도가 올라갑니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--tertiary)]" aria-hidden="true" />
                    <span>항목 순서를 명시하면 결과물이 일관됩니다.</span>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </section>
      </ErrorBoundary>

      {/* ── User Prompts Table ── */}
      <ErrorBoundary>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-sm text-[var(--ink-muted)]">MY PROMPTS</p>
              <h2 className="font-headline text-xl font-bold tracking-tight">개인 등록 프롬프트</h2>
            </div>
            <span className="text-xs text-[var(--ink-muted)]">{userPrompts.length}개</span>
          </div>

          {userPrompts.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-container-low)] p-8 text-center">
              <p className="text-sm text-[var(--ink-muted)]">아직 등록된 프롬프트가 없습니다.</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">위 에디터에서 새 프롬프트를 만들어보세요.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line-soft)] bg-[var(--surface-container-low)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">타입</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]">수정일</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--ink-muted)]">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {userPrompts.map((prompt) => (
                    <tr key={prompt.id} className="border-b border-[var(--line-soft)] last:border-b-0 hover:bg-[var(--surface-container-low)] transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{prompt.name}</td>
                      <td className="px-4 py-3 text-[var(--ink-muted)]">{PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType]}</td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                        {prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(prompt)}
                            className="rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-50"
                            title="편집"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(prompt.id)}
                            className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </ErrorBoundary>
    </div>
  );
}
