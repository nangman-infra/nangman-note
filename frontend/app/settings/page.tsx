'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpenText,
  Edit3,
  GraduationCap,
  Languages,
  Mic,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { useUserSettingsStore } from '@/domains/settings/stores/settingsStore';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';
import { PromptEditorDialog } from '@/domains/prompt/components/PromptEditorDialog';
import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  PROMPT_DOCUMENT_TYPE_LABELS,
  type PromptDocumentType,
} from '@/domains/prompt/types/prompt.types';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';

// ─── Document-type → icon/tile-tone mapping for the System Library grid. ───
// Keeps visual identity consistent with Stitch tile tokens (tonal, no hex).
const DOCUMENT_TYPE_TILE: Record<
  PromptDocumentType,
  { icon: typeof Sparkles; tone: string }
> = {
  meeting: { icon: Users, tone: 'bg-indigo-50 text-indigo-600' },
  lecture: { icon: BookOpenText, tone: 'bg-amber-50 text-amber-700' },
  mentoring: { icon: GraduationCap, tone: 'bg-cyan-50 text-cyan-700' },
};

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const {
    defaultPromptId,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isHydrated,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    error: settingsError,
    fetchSettings,
    updateSettings,
  } = useUserSettingsStore();
  const {
    prompts,
    isLoading,
    error: promptError,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompt();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editorInitialName, setEditorInitialName] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState('');
  const [editorInitialDocumentType, setEditorInitialDocumentType] =
    useState<PromptDocumentType>('meeting');
  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!deleteConfirmId) return;
    const timer = setTimeout(() => setDeleteConfirmId(null), 5000);
    return () => clearTimeout(timer);
  }, [deleteConfirmId]);

  useEffect(() => {
    if (!isHydrated) {
      void fetchSettings();
    }
  }, [fetchSettings, isHydrated]);

  const openCreate = () => {
    setEditorMode('create');
    setEditingPromptId(null);
    setEditorInitialName('');
    setEditorInitialContent('');
    setEditorInitialDocumentType('meeting');
    setEditorOpen(true);
  };

  const openEdit = (prompt: {
    id: string;
    name: string;
    content: string;
    documentType: PromptDocumentType;
  }) => {
    setEditorMode('edit');
    setEditingPromptId(prompt.id);
    setEditorInitialName(prompt.name);
    setEditorInitialContent(prompt.content);
    setEditorInitialDocumentType(prompt.documentType);
    setEditorOpen(true);
  };

  const handleSave = async (
    name: string,
    content: string,
    documentType: PromptDocumentType,
  ) => {
    setIsEditorSaving(true);
    try {
      if (editorMode === 'create') {
        const success = await createPrompt({ name, content, documentType });
        if (!success) {
          pushToast({
            title: '프롬프트 생성에 실패했습니다',
            description: promptError || '잠시 후 다시 시도해주세요.',
            variant: 'error',
          });
          return;
        }
        pushToast({ title: '프롬프트가 생성되었습니다', variant: 'success' });
      } else if (editingPromptId) {
        const success = await updatePrompt(editingPromptId, {
          name,
          content,
          documentType,
        });
        if (!success) {
          pushToast({
            title: '프롬프트 수정에 실패했습니다',
            description: promptError || '잠시 후 다시 시도해주세요.',
            variant: 'error',
          });
          return;
        }
        pushToast({ title: '프롬프트가 수정되었습니다', variant: 'success' });
      }
      setEditorOpen(false);
    } finally {
      setIsEditorSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    const success = await deletePrompt(id);
    if (!success) {
      pushToast({
        title: '프롬프트 삭제에 실패했습니다',
        description: promptError || '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    if (defaultPromptId === id) {
      const reverted = await updateSettings({
        defaultPromptId: DEFAULT_PROMPT_ID,
      });
      if (!reverted) {
        pushToast({
          title: '기본 프롬프트 복구에 실패했습니다',
          description: settingsError || '잠시 후 다시 시도해주세요.',
          variant: 'error',
        });
        return;
      }
    }

    pushToast({ title: '프롬프트가 삭제되었습니다', variant: 'info' });
  };

  const resolvedDefaultPromptId = prompts.some(
    (prompt) => prompt.id === defaultPromptId,
  )
    ? defaultPromptId
    : DEFAULT_PROMPT_ID;

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── Breadcrumb / Back ── */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn-neo mb-5 inline-flex text-xs text-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          워크스페이스로 돌아가기
        </button>

        {/* ── Page Headline ──
             Large editorial headline (Manrope, -0.02em) per Stitch spec. */}
        <div className="mb-8">
          <p className="label-sm mb-2 text-[var(--ink-muted)]">
            Prompt Management
          </p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight sm:text-4xl">
            프롬프트 관리
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            팀에 맞는 회의록 템플릿을 선택·편집하고, 새 회의에 자동 적용할
            기본값을 관리합니다.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
             Section 1 — System Library
             Stitch spec: template grid with icon tile, name, 2-line
             description, updated timestamp, Edit link. The page-level
             "Template Editor" is the PromptEditorDialog launched from
             the Edit / 새 프롬프트 actions in this grid.
            ───────────────────────────────────────────────────────────── */}
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
                onClick={openCreate}
                disabled={isLoading}
                className="btn-primary inline-flex self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />새 프롬프트
              </button>
            </header>

            {/* 3-col template card grid — Stitch spec. */}
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
                    DOCUMENT_TYPE_TILE[prompt.documentType] ??
                    DOCUMENT_TYPE_TILE.meeting;
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
                            onClick={() =>
                              deleteConfirmId === prompt.id
                                ? void handleDelete(prompt.id)
                                : setDeleteConfirmId(prompt.id)
                            }
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
                            onClick={() => openEdit(prompt)}
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

        {/* ─────────────────────────────────────────────────────────────
             Section 2 — Template Editor Defaults
             These are the workspace-level defaults that the Template
             Editor applies when launching a new meeting. The in-depth
             editor for a single template lives in PromptEditorDialog,
             opened from the System Library grid above.
            ───────────────────────────────────────────────────────────── */}
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

            {/* Tonal info pill — No-Line rule (tonal bg, no border). */}
            <p className="mb-6 rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-xs text-[var(--ink-subtle)]">
              💡 이 설정은 사용자 계정 기준으로 저장되며, 같은 계정으로
              로그인한 다른 기기에도 적용됩니다.
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
                  onChange={async (e) => {
                    const success = await updateSettings({
                      defaultPromptId: e.target.value,
                    });
                    if (!success) {
                      pushToast({
                        title: '기본 프롬프트 변경에 실패했습니다',
                        description:
                          settingsError || '잠시 후 다시 시도해주세요.',
                        variant: 'error',
                      });
                      return;
                    }
                    pushToast({
                      title: '기본 프롬프트가 변경되었습니다',
                      variant: 'success',
                    });
                  }}
                  className="input-shell w-full text-sm"
                  disabled={isLoading || isSettingsLoading || isSettingsSaving}
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
                  onChange={async (e) => {
                    const success = await updateSettings({
                      defaultTranscriptionMode: e.target
                        .value as MeetingTranscriptionMode,
                    });
                    if (!success) {
                      pushToast({
                        title: '기본 전사 모드 변경에 실패했습니다',
                        description:
                          settingsError || '잠시 후 다시 시도해주세요.',
                        variant: 'error',
                      });
                      return;
                    }
                    pushToast({
                      title: '기본 전사 모드가 변경되었습니다',
                      variant: 'success',
                    });
                  }}
                  className="input-shell w-full text-sm"
                  disabled={isSettingsLoading || isSettingsSaving}
                >
                  <option value={MeetingTranscriptionMode.REALTIME}>
                    Realtime (실시간 전사)
                  </option>
                  <option value={MeetingTranscriptionMode.BATCH}>
                    Batch (종료 후 전사)
                  </option>
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  새 회의 시작 시 기본으로 적용됩니다. 회의별로 override
                  가능합니다.
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
                  onChange={async (e) => {
                    const success = await updateSettings({
                      defaultLanguageCode: e.target.value,
                    });
                    if (!success) {
                      pushToast({
                        title: '기본 전사 언어 변경에 실패했습니다',
                        description:
                          settingsError || '잠시 후 다시 시도해주세요.',
                        variant: 'error',
                      });
                      return;
                    }
                    pushToast({
                      title: '기본 전사 언어가 변경되었습니다',
                      variant: 'success',
                    });
                  }}
                  className="input-shell w-full text-sm"
                  disabled={isSettingsLoading || isSettingsSaving}
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
                  onChange={async (e) => {
                    const success = await updateSettings({
                      defaultTranslateTargetLanguage: e.target.value,
                    });
                    if (!success) {
                      pushToast({
                        title: '기본 번역 설정 변경에 실패했습니다',
                        description:
                          settingsError || '잠시 후 다시 시도해주세요.',
                        variant: 'error',
                      });
                      return;
                    }
                    pushToast({
                      title: '기본 번역 설정이 변경되었습니다',
                      variant: 'success',
                    });
                  }}
                  className="input-shell w-full text-sm"
                  disabled={isSettingsLoading || isSettingsSaving}
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
      </div>

      {/* Template Editor modal — launched from the System Library grid. */}
      <PromptEditorDialog
        key={editingPromptId ?? 'create'}
        open={editorOpen}
        mode={editorMode}
        initialName={editorInitialName}
        initialContent={editorInitialContent}
        initialDocumentType={editorInitialDocumentType}
        isLoading={isEditorSaving}
        onSave={handleSave}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}
