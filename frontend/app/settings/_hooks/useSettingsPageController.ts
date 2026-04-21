'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { MeetingTranscriptionMode } from '@/domains/meeting';
import {
  type Prompt,
  type PromptDocumentType,
  usePrompt,
} from '@/domains/prompt';
import { useUserSettingsStore } from '@/domains/settings';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';

export function useSettingsPageController() {
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

  const handleDefaultPromptChange = async (nextDefaultPromptId: string) => {
    const success = await updateSettings({ defaultPromptId: nextDefaultPromptId });
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
    nextDefaultTranscriptionMode: MeetingTranscriptionMode,
  ) => {
    const success = await updateSettings({
      defaultTranscriptionMode: nextDefaultTranscriptionMode,
    });
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

  const handleDefaultLanguageChange = async (nextDefaultLanguageCode: string) => {
    const success = await updateSettings({
      defaultLanguageCode: nextDefaultLanguageCode,
    });
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
    nextDefaultTranslateTargetLanguage: string,
  ) => {
    const success = await updateSettings({
      defaultTranslateTargetLanguage: nextDefaultTranslateTargetLanguage,
    });
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

  const hasDefaultPrompt = prompts.some((prompt) => prompt.id === defaultPromptId);
  const resolvedDefaultPromptId = hasDefaultPrompt
    ? defaultPromptId
    : DEFAULT_PROMPT_ID;

  return {
    prompts,
    isLoading,
    deleteConfirmId,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isSettingsLoading,
    isSettingsSaving,
    resolvedDefaultPromptId,
    editor: {
      key: editingPromptId ?? 'create',
      open: editorOpen,
      mode: editorMode,
      initialName: editorInitialName,
      initialContent: editorInitialContent,
      initialDocumentType: editorInitialDocumentType,
      isLoading: isEditorSaving,
    },
    actions: {
      openCreate,
      openEdit,
      handleDeleteClick,
      handleDefaultPromptChange,
      handleDefaultModeChange,
      handleDefaultLanguageChange,
      handleDefaultTranslateLanguageChange,
      handleSave,
      handleCancel: () => setEditorOpen(false),
      handleBack: () => router.push('/'),
    },
  };
}
