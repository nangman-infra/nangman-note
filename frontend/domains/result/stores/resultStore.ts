import { create } from 'zustand';
import { resultApi } from '../api/resultApi';
import type { MeetingResult } from '../types/result.types';

interface ResultState {
  result: MeetingResult | null;
  isLoading: boolean;
  isRegenerating: boolean;
  error: string | null;

  // Actions
  fetchResult: (meetingId: string) => Promise<void>;
  updateResult: (meetingId: string, content: string) => Promise<void>;
  regenerateResult: (meetingId: string, promptId: string) => Promise<void>;
  exportPDF: (meetingId: string) => Promise<void>;
  clearResult: () => void;
}

export const useResultStore = create<ResultState>((set, get) => ({
  result: null,
  isLoading: false,
  isRegenerating: false,
  error: null,

  fetchResult: async (meetingId) => {
    try {
      set({ isLoading: true, error: null });
      const result = await resultApi.get(meetingId);
      set({ result, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch result',
        isLoading: false 
      });
    }
  },

  updateResult: async (meetingId, content) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await resultApi.update(meetingId, content);
      set({ result: updated, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update result',
        isLoading: false 
      });
    }
  },

  regenerateResult: async (meetingId, promptId) => {
    try {
      set({ isRegenerating: true, error: null });
      const regenerated = await resultApi.regenerate(meetingId, promptId);
      set({ result: regenerated, isRegenerating: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to regenerate result',
        isRegenerating: false 
      });
    }
  },

  exportPDF: async (meetingId) => {
    try {
      set({ error: null });
      const blob = await resultApi.exportPDF(meetingId);
      
      // 다운로드 트리거
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting_${meetingId}_result.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to export PDF'
      });
    }
  },

  clearResult: () => {
    set({ result: null, error: null });
  },
}));
