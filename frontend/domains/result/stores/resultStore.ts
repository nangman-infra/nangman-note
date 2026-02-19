import { create } from 'zustand';
import { resultApi } from '../api/resultApi';
import type { MeetingResult } from '../types/result.types';

interface ResultState {
  result: MeetingResult | null;
  isLoading: boolean;
  isRegenerating: boolean;
  error: string | null;
  fetchResult: (meetingId: string) => Promise<void>;
  updateResult: (meetingId: string, content: string) => Promise<boolean>;
  regenerateResult: (meetingId: string, promptId: string) => Promise<boolean>;
  exportPDF: (meetingId: string) => Promise<boolean>;
  clearResult: () => void;
}

export const useResultStore = create<ResultState>((set) => ({
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
        isLoading: false,
      });
    }
  },

  updateResult: async (meetingId, content) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await resultApi.update(meetingId, content);
      set({ result: updated, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update result',
        isLoading: false,
      });
      return false;
    }
  },

  regenerateResult: async (meetingId, promptId) => {
    try {
      set({ isRegenerating: true, error: null });
      const regenerated = await resultApi.regenerate(meetingId, promptId);
      set({ result: regenerated, isRegenerating: false });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to regenerate result',
        isRegenerating: false,
      });
      return false;
    }
  },

  exportPDF: async (meetingId) => {
    try {
      set({ error: null });
      const blob = await resultApi.exportPDF(meetingId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `meeting_${meetingId}_result.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to export PDF',
      });
      return false;
    }
  },

  clearResult: () => {
    set({ result: null, error: null });
  },
}));
