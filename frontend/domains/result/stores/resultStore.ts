import { create } from 'zustand';
import { resultApi } from '../api/resultApi';
import type { MeetingResult } from '../types/result.types';
import { ApiError } from '@/lib/api/client';

interface ResultState {
  result: MeetingResult | null;
  isLoading: boolean;
  isRegenerating: boolean;
  isPending: boolean;
  isMissingMeeting: boolean;
  error: string | null;
  fetchResult: (meetingId: string, options?: { silent?: boolean }) => Promise<void>;
  updateResult: (meetingId: string, content: string) => Promise<boolean>;
  regenerateResult: (meetingId: string, promptId: string) => Promise<boolean>;
  applyRegenerateEvent: (event: { meetingId: string; phase: string; errorMessage?: string }) => void;
  exportPDF: (meetingId: string) => Promise<boolean>;
  exportDOCX: (meetingId: string) => Promise<boolean>;
  clearResult: () => void;
}

export const useResultStore = create<ResultState>((set) => ({
  result: null,
  isLoading: false,
  isRegenerating: false,
  isPending: false,
  isMissingMeeting: false,
  error: null,

  fetchResult: async (meetingId, options) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        set({
          isLoading: true,
          error: null,
          isPending: false,
          isMissingMeeting: false,
        });
      }
      const result = await resultApi.get(meetingId);
      const prev = useResultStore.getState();
      // 폴링 폴백: 재생성 중 결과가 바뀌면 (generatedAt 변경) → isRegenerating 해제
      const wasRegenerating = prev.isRegenerating;
      const prevGeneratedAt = prev.result?.metadata?.generatedAt ?? null;
      const nextGeneratedAt = result.metadata?.generatedAt ?? null;
      const generatedAtChanged =
        wasRegenerating &&
        prevGeneratedAt !== null &&
        nextGeneratedAt !== null &&
        prevGeneratedAt !== nextGeneratedAt;

      set({
        result,
        isLoading: false,
        isPending: false,
        isMissingMeeting: false,
        ...(generatedAtChanged ? { isRegenerating: false, error: null } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch result';
      const lowered = message.toLowerCase();
      const apiError = error instanceof ApiError ? error : null;

      if (
        apiError?.code === 'RESULT_NOT_READY' ||
        lowered.includes('not ready yet')
      ) {
        set({
          result: null,
          isLoading: false,
          isPending: true,
          isMissingMeeting: false,
          error: null,
        });
        return;
      }

      if (
        apiError?.code === 'MEETING_NOT_FOUND' ||
        (lowered.includes('meeting') && lowered.includes('not found'))
      ) {
        set({
          result: null,
          isLoading: false,
          isPending: false,
          isMissingMeeting: true,
          error: null,
        });
        return;
      }

      if (!silent) {
        set({
          error: message,
          isLoading: false,
          isPending: false,
          isMissingMeeting: false,
        });
      }
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
      await resultApi.regenerate(meetingId, promptId);
      // 202 Accepted — 백그라운드에서 처리 중
      // isRegenerating은 WebSocket result:regenerate completed/failed 이벤트로 해제
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to regenerate result',
        isRegenerating: false,
      });
      return false;
    }
  },

  /** WebSocket result:regenerate 이벤트 핸들러 */
  applyRegenerateEvent: (event: { meetingId: string; phase: string; errorMessage?: string }) => {
    const state = useResultStore.getState();
    if (!state.result || state.result.meetingId !== event.meetingId) return;

    if (event.phase === 'started') {
      set({ isRegenerating: true, error: null });
    } else if (event.phase === 'completed') {
      set({ isRegenerating: false, error: null });
      // 완료 시 결과를 다시 fetch (silent — 로딩 화면 방지)
      void useResultStore.getState().fetchResult(event.meetingId, { silent: true });
    } else if (event.phase === 'failed') {
      set({
        isRegenerating: false,
        error: event.errorMessage || 'AI 회의록 재생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
      });
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

  exportDOCX: async (meetingId) => {
    try {
      set({ error: null });
      const blob = await resultApi.exportDOCX(meetingId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `meeting_${meetingId}_result.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to export DOCX',
      });
      return false;
    }
  },

  clearResult: () => {
    set({
      result: null,
      error: null,
      isPending: false,
      isMissingMeeting: false,
    });
  },
}));
