'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { usePrompt } from '../hooks/usePrompt';
import { PromptEditorDialog } from './PromptEditorDialog';

interface PromptSelectorProps {
  onChange?: (promptId: string) => void;
}

export function PromptSelector({ onChange }: PromptSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    prompts,
    selectedPromptId,
    isLoading,
    setSelectedPrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompt();

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editorInitialName, setEditorInitialName] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleChange = (promptId: string) => {
    setSelectedPrompt(promptId);
    onChange?.(promptId);
  };

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
      } else if (editingPromptId) {
        await updatePrompt(editingPromptId, { name, content });
      }
      setEditorOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    await deletePrompt(id);
    if (selectedPromptId === id) {
      const fallback = prompts.find((p) => p.id !== id && p.isDefault);
      if (fallback) {
        handleChange(fallback.id);
      }
    }
  };

  return (
    <div className="surface-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-brand" />
            프롬프트 설정
          </span>
          <span className="text-muted">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--line-soft)] bg-white p-3 transition hover:border-[var(--line-strong)]">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted">현재 선택</p>
          <p className="text-sm font-medium">{selectedPrompt?.name || '기본 회의록 프롬프트'}</p>
        </div>
      </button>

      {expanded && (
        <div className="motion-rise mt-3 space-y-2">
          {prompts.map((prompt) => {
            const isSelected = selectedPromptId === prompt.id;
            return (
              <div key={prompt.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleChange(prompt.id)}
                  className={`surface-card block w-full cursor-pointer p-3 text-left transition ${
                    isSelected ? 'border-[var(--line-strong)] bg-brand/5' : 'hover:border-[var(--line-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? 'border-brand bg-brand' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="text-sm font-medium">{prompt.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {prompt.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
                          <Sparkles className="h-3 w-3" />
                          기본
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(prompt); }}
                            className="rounded-full p-1 text-muted transition hover:bg-black/5"
                            aria-label="편집"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {deleteConfirmId === prompt.id ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleDelete(prompt.id); }}
                              className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"
                            >
                              삭제 확인
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(prompt.id); }}
                              className="rounded-full p-1 text-muted transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="삭제"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted">{prompt.content}</p>
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={openCreate}
            disabled={isLoading}
            className="btn-neo w-full justify-center border-dashed text-xs text-brand"
          >
            <Plus className="h-3.5 w-3.5" />
            새 프롬프트 만들기
          </button>
        </div>
      )}

      <PromptEditorDialog key={editingPromptId ?? "create"}
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
