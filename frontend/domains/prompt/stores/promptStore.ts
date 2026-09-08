import { create } from 'zustand';
import { promptApi } from '../api/promptApi';
import type { CreatePromptDto, Prompt } from '../types/prompt.types';

interface PromptState {
  prompts: Prompt[];
  isLoading: boolean;
  /** 최초 목록 로드가 성공적으로 끝났는지. consumer 마운트마다 재요청하지 않기 위한 플래그 */
  hasLoaded: boolean;
  error: string | null;
  fetchPrompts: () => Promise<void>;
  createPrompt: (dto: CreatePromptDto) => Promise<boolean>;
  updatePrompt: (id: string, dto: Partial<CreatePromptDto>) => Promise<boolean>;
  deletePrompt: (id: string) => Promise<boolean>;
}

export const usePromptStore = create<PromptState>()((set, get) => ({
  prompts: [],
  isLoading: false,
  hasLoaded: false,
  error: null,

  fetchPrompts: async () => {
    // 여러 consumer 가 동시에 마운트돼도 요청은 1개만 나간다.
    if (get().isLoading) return;
    try {
      set({ isLoading: true, error: null });
      const prompts = await promptApi.list();
      set({
        prompts,
        isLoading: false,
        hasLoaded: true,
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
}));
