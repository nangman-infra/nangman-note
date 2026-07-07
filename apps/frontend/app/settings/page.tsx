'use client';

import { PromptEditorDialog } from '@/domains/prompt';
import { DefaultSettingsSection } from './_components/DefaultSettingsSection';
import { PromptTemplateLibrarySection } from './_components/PromptTemplateLibrarySection';
import { SettingsPageHeader } from './_components/SettingsPageHeader';
import { useSettingsPageController } from './_hooks/useSettingsPageController';

export default function SettingsPage() {
  const {
    prompts,
    defaultTranscriptionMode,
    defaultLanguageCode,
    defaultTranslateTargetLanguage,
    isSettingsLoading,
    isSettingsSaving,
    isLoading,
    deleteConfirmId,
    resolvedDefaultPromptId,
    editor,
    actions,
  } = useSettingsPageController();

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <SettingsPageHeader onBack={actions.handleBack} />
        <PromptTemplateLibrarySection
          prompts={prompts}
          isLoading={isLoading}
          deleteConfirmId={deleteConfirmId}
          onCreate={actions.openCreate}
          onEdit={actions.openEdit}
          onDeleteClick={actions.handleDeleteClick}
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
          onDefaultPromptChange={actions.handleDefaultPromptChange}
          onDefaultModeChange={actions.handleDefaultModeChange}
          onDefaultLanguageChange={actions.handleDefaultLanguageChange}
          onDefaultTranslateLanguageChange={
            actions.handleDefaultTranslateLanguageChange
          }
        />
      </div>

      <PromptEditorDialog
        key={editor.key}
        open={editor.open}
        mode={editor.mode}
        initialName={editor.initialName}
        initialContent={editor.initialContent}
        initialDocumentType={editor.initialDocumentType}
        isLoading={editor.isLoading}
        onSave={actions.handleSave}
        onCancel={actions.handleCancel}
      />
    </div>
  );
}
