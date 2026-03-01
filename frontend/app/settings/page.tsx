'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit3, Languages, Mic, Plus, Save, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { useMeetingSettingsStore } from '@/domains/meeting/stores/settingsStore';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { PromptEditorDialog } from '@/domains/prompt/components/PromptEditorDialog';

export default function SettingsPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();

  const {
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    setDefaultTranscriptionMode,
    setDefaultLanguageCode,
    setDefaultTranslateTargetLanguage,
  } = useMeetingSettingsStore();

  const {
    prompts,
    isLoading,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompt();

  // 프롬프트 에디터
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editorInitialName, setEditorInitialName] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openCreate = () => {
    setEditorMode('create');
    setEditingPromptId(null);
    setEditorInitialName('');
    setEditorInitialContent('');
    setEditorOpen(true);
  };

  const openEdit = (prompt: { id: string; name: string; content: string }) => {
    setEditorMode('edit');
    setEditingPromptId(prompt.id);
    setEditorInitialName(prompt.name);
    setEditorInitialContent(prompt.content);
    setEditorOpen(true);
  };

  const handleSave = async (name: string, content: string) => {
    setIsSaving(true);
    try {
      if (editorMode === 'create') {
        await createPrompt({ name, content });
        pushToast({ title: '프롬프트가 생성되었습니다', variant: 'success' });
      } else if (editingPromptId) {
        await updatePrompt(editingPromptId, { name, content });
        pushToast({ title: '프롬프트가 수정되었습니다', variant: 'success' });
      }
      setEditorOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    await deletePrompt(id);
    pushToast({ title: '프롬프트가 삭제되었습니다', variant: 'info' });
  };

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <button type="button" onClick={() => router.push('/')} className="btn-neo mb-5 text-xs text-muted">
          <ArrowLeft className="h-3.5 w-3.5" />
          워크스페이스로 돌아가기
        </button>

        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-brand">
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </div>
          <h1 className="text-3xl font-semibold">설정</h1>
          <p className="mt-1 text-sm text-muted">
            기본 전사 설정과 프롬프트를 관리합니다. 여기서 설정한 값은 새 회의 시작 시 자동 적용됩니다.
          </p>
        </div>

        {/* 전사 기본 설정 */}
        <section className="glass-surface mb-6 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Mic className="h-5 w-5 text-brand" />
            전사 기본 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="default-mode" className="mb-1.5 block text-sm font-medium">
                기본 전사 모드
              </label>
              <select
                id="default-mode"
                value={defaultTranscriptionMode}
                onChange={(e) => {
                  setDefaultTranscriptionMode(e.target.value as MeetingTranscriptionMode);
                  pushToast({ title: '기본 전사 모드가 변경되었습니다', variant: 'success' });
                }}
                className="input-shell w-full text-sm"
              >
                <option value={MeetingTranscriptionMode.REALTIME}>Realtime (실시간 전사)</option>
                <option value={MeetingTranscriptionMode.BATCH}>Batch (종료 후 전사)</option>
              </select>
              <p className="mt-1 text-[11px] text-muted">
                새 회의 시작 시 기본으로 적용됩니다. 회의별로 override 가능합니다.
              </p>
            </div>

            <div>
              <label htmlFor="default-lang" className="mb-1.5 block text-sm font-medium">
                기본 전사 언어
              </label>
              <select
                id="default-lang"
                value={defaultLanguageCode}
                onChange={(e) => {
                  setDefaultLanguageCode(e.target.value);
                  pushToast({ title: '기본 전사 언어가 변경되었습니다', variant: 'success' });
                }}
                className="input-shell w-full text-sm"
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
              <label htmlFor="default-translate" className="mb-1.5 block text-sm font-medium">
                <Languages className="mr-1 inline-block h-4 w-4" />
                기본 번역 대상 언어
              </label>
              <select
                id="default-translate"
                value={defaultTranslateTargetLanguage}
                onChange={(e) => {
                  setDefaultTranslateTargetLanguage(e.target.value);
                  pushToast({ title: '기본 번역 설정이 변경되었습니다', variant: 'success' });
                }}
                className="input-shell w-full text-sm"
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

        {/* 프롬프트 관리 */}
        <section className="glass-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-brand" />
              프롬프트 관리
            </h2>
            <button
              type="button"
              onClick={openCreate}
              disabled={isLoading}
              className="btn-neo text-xs text-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              새 프롬프트
            </button>
          </div>

          <div className="space-y-2">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="surface-card flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{prompt.name}</p>
                    {prompt.isDefault && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-muted">
                        기본
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{prompt.content}</p>
                </div>

                {!prompt.isDefault && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(prompt)}
                      className="rounded-full p-1.5 text-muted transition hover:bg-black/5"
                      aria-label="편집"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {deleteConfirmId === prompt.id ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(prompt.id)}
                        className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"
                      >
                        삭제 확인
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(prompt.id)}
                        className="rounded-full p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {prompts.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                등록된 프롬프트가 없습니다. 새 프롬프트를 만들어보세요.
              </p>
            )}
          </div>
        </section>
      </div>

      <PromptEditorDialog
        key={editingPromptId ?? 'create'}
        open={editorOpen}
        mode={editorMode}
        initialName={editorInitialName}
        initialContent={editorInitialContent}
        isLoading={isSaving}
        onSave={handleSave}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}