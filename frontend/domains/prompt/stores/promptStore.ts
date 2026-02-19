import { create } from 'zustand';
import { promptApi } from '../api/promptApi';
import type { Prompt, CreatePromptDto } from '../types/prompt.types';

interface PromptState {
  prompts: Prompt[];
  selectedPromptId: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPrompts: () => Promise<void>;
  createPrompt: (dto: CreatePromptDto) => Promise<void>;
  updatePrompt: (id: string, dto: Partial<CreatePromptDto>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  setSelectedPrompt: (id: string) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  selectedPromptId: 'prompt_default_meeting', // 기본값
  isLoading: false,
  error: null,

  fetchPrompts: async () => {
    try {
      set({ isLoading: true, error: null });
      const prompts = await promptApi.list();
      set({ prompts, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch prompts',
        isLoading: false 
      });
    }
  },

  createPrompt: async (dto) => {
    try {
      set({ isLoading: true, error: null });
      const newPrompt = await promptApi.create(dto);
      set((state) => ({
        prompts: [...state.prompts, newPrompt],
        isLoading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create prompt',
        isLoading: false 
      });
    }
  },

  updatePrompt: async (id, dto) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await promptApi.update(id, dto);
      set((state) => ({
        prompts: state.prompts.map((p) => (p.id === id ? updated : p)),
        isLoading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update prompt',
        isLoading: false 
      });
    }
  },

  deletePrompt: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await promptApi.delete(id);
      set((state) => ({
        prompts: state.prompts.filter((p) => p.id !== id),
        isLoading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete prompt',
        isLoading: false 
      });
    }
  },

  setSelectedPrompt: (id) => {
    set({ selectedPromptId: id });
  },
}));
