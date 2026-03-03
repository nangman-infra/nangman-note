import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { promptApi } from '../api/promptApi';
import type { CreatePromptDto, Prompt } from '../types/prompt.types';

interface PromptState {
  prompts: Prompt[];
  selectedPromptId: string;
  isLoading: boolean;
  error: string | null;
  fetchPrompts: () => Promise<void>;
  createPrompt: (dto: CreatePromptDto) => Promise<boolean>;
  updatePrompt: (id: string, dto: Partial<CreatePromptDto>) => Promise<boolean>;
  deletePrompt: (id: string) => Promise<boolean>;
  setSelectedPrompt: (id: string) => void;
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      prompts: [],
      selectedPromptId: 'prompt_default_meeting',
      isLoading: false,
      error: null,

      fetchPrompts: async () => {
        try {
          set({ isLoading: true, error: null });
          const prompts = await promptApi.list();
          set((state) => {
            const hasSelected = prompts.some(
              (prompt) => prompt.id === state.selectedPromptId,
            );
            const defaultPrompt = prompts.find((prompt) => prompt.isDefault);

            return {
              prompts,
              selectedPromptId: hasSelected
                ? state.selectedPromptId
                : (defaultPrompt?.id ?? 'prompt_default_meeting'),
              isLoading: false,
            };
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch prompts',
            isLoading: false,
          });
        }
      },

      createPrompt: async (dto) => {
        try {
          set({ isLoading: true, error: null });
          const newPrompt = await promptApi.create(dto);
          set((state) => ({
            prompts: [...state.prompts, newPrompt],
            isLoading: false,
          }));
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create prompt',
            isLoading: false,
          });
          return false;
        }
      },

      updatePrompt: async (id, dto) => {
        try {
          set({ isLoading: true, error: null });
          const updated = await promptApi.update(id, dto);
          set((state) => ({
            prompts: state.prompts.map((prompt) =>
              prompt.id === id ? updated : prompt,
            ),
            isLoading: false,
          }));
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update prompt',
            isLoading: false,
          });
          return false;
        }
      },

      deletePrompt: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await promptApi.delete(id);
          set((state) => ({
            prompts: state.prompts.filter((prompt) => prompt.id !== id),
            selectedPromptId:
              state.selectedPromptId === id
                ? (state.prompts.find((prompt) => prompt.isDefault)?.id ??
                  'prompt_default_meeting')
                : state.selectedPromptId,
            isLoading: false,
          }));
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete prompt',
            isLoading: false,
          });
          return false;
        }
      },

      setSelectedPrompt: (id) => {
        set({ selectedPromptId: id });
      },
    }),
    {
      name: 'transnote-prompt-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPromptId: state.selectedPromptId,
      }),
    },
  ),
);
