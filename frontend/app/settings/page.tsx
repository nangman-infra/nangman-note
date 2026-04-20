'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { useUserSettingsStore } from '@/domains/settings/stores/settingsStore';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { usePrompt } from '@/domains/prompt/hooks/usePrompt';
import { PromptEditorDialog } from '@/domains/prompt/components/PromptEditorDialog';
import type { Prompt, PromptDocumentType } from '@/domains/prompt/types/prompt.types';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { DefaultSettingsSection } from './_components/DefaultSettingsSection';
import { PromptTemplateLibrarySection } from './_components/PromptTemplateLibrarySection';
import { SettingsPageHeader } from './_components/SettingsPageHeader';

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

  const openEdit = (prompt: Prompt) => {
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

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      void handleDelete(id);
      return;
    }
    setDeleteConfirmId(id);
  };

  const handleDefaultPromptChange = async (defaultPromptId: string) => {
    const success = await updateSettings({ defaultPromptId });
    if (!success) {
      pushToast({
        title: '기본 프롬프트 변경에 실패했습니다',
        description: settingsError || '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }
    pushToast({ title: '기본 프롬프트가 변경되었습니다', variant: 'success' });
  };

  const handleDefaultModeChange = async (
    defaultTranscriptionMode: MeetingTranscriptionMode,
  ) => {
    const success = await updateSettings({ defaultTranscriptionMode });
    if (!success) {
      pushToast({
        title: '기본 전사 모드 변경에 실패했습니다',
        description: settingsError || '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }
    pushToast({ title: '기본 전사 모드가 변경되었습니다', variant: 'success' });
  };

  const handleDefaultLanguageChange = async (defaultLanguageCode: string) => {
    const success = await updateSettings({ defaultLanguageCode });
    if (!success) {
      pushToast({
        title: '기본 전사 언어 변경에 실패했습니다',
        description: settingsError || '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }
    pushToast({ title: '기본 전사 언어가 변경되었습니다', variant: 'success' });
  };

  const handleDefaultTranslateLanguageChange = async (
    defaultTranslateTargetLanguage: string,
  ) => {
    const success = await updateSettings({ defaultTranslateTargetLanguage });
    if (!success) {
      pushToast({
        title: '기본 번역 설정 변경에 실패했습니다',
        description: settingsError || '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }
    pushToast({ title: '기본 번역 설정이 변경되었습니다', variant: 'success' });
  };

  const resolvedDefaultPromptId = prompts.some(
    (prompt) => prompt.id === defaultPromptId,
  )
    ? defaultPromptId
    : DEFAULT_PROMPT_ID;

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <SettingsPageHeader onBack={() => router.push('/')} />
        <PromptTemplateLibrarySection
          prompts={prompts}
          isLoading={isLoading}
          deleteConfirmId={deleteConfirmId}
          onCreate={openCreate}
          onEdit={openEdit}
          onDeleteClick={handleDeleteClick}
        />
        <DefaultSettingsSection
          prompts={prompts}
          resolvedDefaultPromptId={resolvedDefaultPromptId}
          defaultTranscriptionMode={defaultTranscriptionMode}
          defaultLanguageCode={defaultLanguageCode}
          defaultTranslateTargetLanguage={defaultTranslateTargetLanguage}
          isPromptLoading={isLoading}
          isSettingsLoading={isSettingsLoading}
          isSettingsSaving={isSettingsSaving}
          onDefaultPromptChange={handleDefaultPromptChange}
          onDefaultModeChange={handleDefaultModeChange}
          onDefaultLanguageChange={handleDefaultLanguageChange}
          onDefaultTranslateLanguageChange={handleDefaultTranslateLanguageChange}
        />
      </div>

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
