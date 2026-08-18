import { create } from 'zustand';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { meetingApi } from '../api/meetingApi';
import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import {
  type CreateMeetingDto,
  type Meeting,
  type SearchResult,
} from '../types/meeting.types';

interface BulkResult {
  succeeded: string[];
  failed: string[];
}

interface MeetingState {
  currentMeeting: Meeting | null;
  isRecording: boolean;
  elapsedTime: number;
  meetings: Meeting[];
  trashMeetings: Meeting[];
  /** 서버에 더 불러올 이전 회의가 남아 있는지 */
  hasMoreMeetings: boolean;
  /** 현재까지 로드한 서버 페이지 수 */
  meetingsPage: number;
  isLoadingMore: boolean;
  isLoading: boolean;
  error: string | null;
  startMeeting: (dto: CreateMeetingDto) => Promise<Meeting | null>;
  endMeeting: (options?: {
    skipTranscription?: boolean;
    markAttentionRequired?: boolean;
  }) => Promise<boolean>;
  updatePrompt: (promptId: string) => Promise<Meeting | null>;
  fetchMeetings: (options?: { silent?: boolean }) => Promise<void>;
  /** 다음 페이지의 이전 회의를 이어서 로드 (서버 페이지네이션) */
  loadMoreMeetings: () => Promise<void>;
  fetchTrashMeetings: (options?: { silent?: boolean }) => Promise<void>;
  searchMeetings: (query: string, scope?: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<boolean>;
  restoreMeeting: (id: string) => Promise<boolean>;
  purgeMeeting: (id: string) => Promise<boolean>;
  bulkDeleteMeetings: (ids: string[]) => Promise<BulkResult | null>;
  bulkRestoreMeetings: (ids: string[]) => Promise<BulkResult | null>;
  bulkPurgeMeetings: (ids: string[]) => Promise<BulkResult | null>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  applyMeetingStatusUpdate: (update: {
    meetingId: string;
    status: Meeting['status'];
    phase?: Meeting['processingPhase'];
    needsAttention?: boolean;
    completionState?: Meeting['completionState'];
  }) => void;
  applyResultRegenerateUpdate: (update: {
    meetingId: string;
    phase: 'started' | 'completed' | 'failed';
  }) => void;
}

const MEETINGS_PAGE_SIZE = 50;

function mapSearchResultToMeeting(result: SearchResult): Meeting {
  const fallbackCompletionState =
    result.completionState ?? getFallbackCompletionState(result);

  return {
    id: result.meetingId,
    title: result.title || result.snippet,
    promptId: DEFAULT_PROMPT_ID,
    status: result.status,
    processingPhase: result.processingPhase ?? null,
    needsAttention: result.needsAttention,
    completionState: fallbackCompletionState,
    transcriptionMode: result.transcriptionMode,
    startedAt: result.startedAt,
    createdAt: result.startedAt,
    updatedAt: result.startedAt,
    // 검색 문맥 정보 보존 — 검색 결과 카드에서 매치 위치·스니펫 표시
    searchMatchedIn: result.matchedIn,
    searchSnippet: result.snippet,
  };
}

function getFallbackCompletionState(
  result: SearchResult,
): MeetingCompletionState | null {
  if (result.needsAttention) return MeetingCompletionState.ATTENTION_REQUIRED;
  if (result.status === 'completed') return MeetingCompletionState.SUCCEEDED;
  return null;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  currentMeeting: null,
  isRecording: false,
  elapsedTime: 0,
  meetings: [],
  trashMeetings: [],
  hasMoreMeetings: false,
  meetingsPage: 1,
  isLoadingMore: false,
  isLoading: false,
  error: null,

  startMeeting: async (dto) => {
    try {
      set({ isLoading: true, error: null });
      const meeting = await meetingApi.create(dto);
      set({ currentMeeting: meeting, isRecording: true, isLoading: false });
      return meeting;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start meeting',
        isLoading: false,
      });
      return null;
    }
  },

  endMeeting: async (options) => {
    const { currentMeeting } = get();
    if (!currentMeeting) return false;

    try {
      set({ isLoading: true, error: null });
      const completedMeeting = await meetingApi.complete(currentMeeting.id, options);
      set({
        currentMeeting: completedMeeting,
        isRecording: false,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to end meeting',
        isLoading: false,
      });
      return false;
    }
  },

  updatePrompt: async (promptId) => {
    const { currentMeeting } = get();
    if (!currentMeeting) return null;

    try {
      set({ isLoading: true, error: null });
      const updated = await meetingApi.updatePrompt(currentMeeting.id, promptId);
      set({ currentMeeting: updated, isLoading: false });
      return updated;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update prompt',
        isLoading: false,
      });
      return null;
    }
  },

  fetchMeetings: async (options) => {
    const shouldShowLoading = !options?.silent;
    try {
      if (shouldShowLoading) {
        set({ isLoading: true, error: null });
      }
      // silent 갱신은 사용자가 이미 펼친 페이지 범위를 모두 다시 읽는다.
      // 첫 페이지만 새 응답에 섞으면 삭제된 tail 회의를 구분할 수 없어
      // 유령 항목으로 남는다.
      const loadedPageCount = options?.silent ? get().meetingsPage : 1;
      const pages = await Promise.all(
        Array.from({ length: loadedPageCount }, (_, index) =>
          meetingApi.list({
            page: index + 1,
            limit: MEETINGS_PAGE_SIZE,
          }),
        ),
      );
      const meetings = pages.flat();
      const lastPage = pages[pages.length - 1] ?? [];
      set((state) => {
        const seenIds = new Set<string>();
        const uniqueMeetings = meetings.filter((meeting) => {
          if (seenIds.has(meeting.id)) return false;
          seenIds.add(meeting.id);
          return true;
        });

        return {
          meetings: uniqueMeetings,
          hasMoreMeetings: lastPage.length === MEETINGS_PAGE_SIZE,
          meetingsPage: options?.silent ? loadedPageCount : 1,
          error: null,
          isLoading: shouldShowLoading ? false : state.isLoading,
        };
      });
    } catch (error) {
      if (shouldShowLoading) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch meetings',
          isLoading: false,
        });
      }
    }
  },

  loadMoreMeetings: async () => {
    const { meetingsPage, isLoadingMore, hasMoreMeetings } = get();
    if (isLoadingMore || !hasMoreMeetings) return;

    try {
      set({ isLoadingMore: true });
      const nextPage = meetingsPage + 1;
      const older = await meetingApi.list({
        page: nextPage,
        limit: MEETINGS_PAGE_SIZE,
      });
      set((state) => {
        const existingIds = new Set(state.meetings.map((meeting) => meeting.id));
        const appended = older.filter((meeting) => !existingIds.has(meeting.id));
        return {
          meetings: [...state.meetings, ...appended],
          meetingsPage: nextPage,
          hasMoreMeetings: older.length === MEETINGS_PAGE_SIZE,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load more meetings',
        isLoadingMore: false,
      });
    }
  },

  fetchTrashMeetings: async (options) => {
    const shouldShowLoading = !options?.silent;
    try {
      if (shouldShowLoading) {
        set({ isLoading: true, error: null });
      }
      const trashMeetings = await meetingApi.listTrash();
      set((state) => ({
        trashMeetings,
        error: null,
        isLoading: shouldShowLoading ? false : state.isLoading,
      }));
    } catch (error) {
      if (shouldShowLoading) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch trash meetings',
          isLoading: false,
        });
      }
    }
  },

  searchMeetings: async (query, scope = 'all') => {
    try {
      set({ isLoading: true, error: null });
      const results = await meetingApi.search(query, scope);
      set({ meetings: results.map(mapSearchResultToMeeting), isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to search meetings',
        isLoading: false,
      });
    }
  },

  deleteMeeting: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await meetingApi.delete(id);
      set((state) => ({
        meetings: state.meetings.filter((meeting) => meeting.id !== id),
        trashMeetings: state.trashMeetings.filter((meeting) => meeting.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete meeting',
        isLoading: false,
      });
      return false;
    }
  },

  restoreMeeting: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await meetingApi.restore(id);
      set((state) => ({
        trashMeetings: state.trashMeetings.filter((meeting) => meeting.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to restore meeting',
        isLoading: false,
      });
      return false;
    }
  },

  purgeMeeting: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await meetingApi.purge(id);
      set((state) => ({
        trashMeetings: state.trashMeetings.filter((meeting) => meeting.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to permanently delete meeting',
        isLoading: false,
      });
      return false;
    }
  },

  bulkDeleteMeetings: async (ids) => {
    try {
      set({ isLoading: true, error: null });
      const result = await meetingApi.bulkDelete(ids);
      const succeededSet = new Set(result.succeeded);
      set((state) => ({
        meetings: state.meetings.filter((m) => !succeededSet.has(m.id)),
        isLoading: false,
      }));
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to bulk delete meetings',
        isLoading: false,
      });
      return null;
    }
  },

  bulkRestoreMeetings: async (ids) => {
    try {
      set({ isLoading: true, error: null });
      const result = await meetingApi.bulkRestore(ids);
      const succeededSet = new Set(result.succeeded);
      set((state) => ({
        trashMeetings: state.trashMeetings.filter((m) => !succeededSet.has(m.id)),
        isLoading: false,
      }));
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to bulk restore meetings',
        isLoading: false,
      });
      return null;
    }
  },

  bulkPurgeMeetings: async (ids) => {
    try {
      set({ isLoading: true, error: null });
      const result = await meetingApi.bulkPurge(ids);
      const succeededSet = new Set(result.succeeded);
      set((state) => ({
        trashMeetings: state.trashMeetings.filter((m) => !succeededSet.has(m.id)),
        isLoading: false,
      }));
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to bulk purge meetings',
        isLoading: false,
      });
      return null;
    }
  },

  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },

  applyMeetingStatusUpdate: ({
    meetingId,
    status,
    phase,
    needsAttention,
    completionState,
  }) => {
    set((state) => {
      const nextMeetings = state.meetings.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              status,
              processingPhase: phase ?? (status === 'completed' ? null : meeting.processingPhase),
              needsAttention: needsAttention ?? meeting.needsAttention,
              completionState: completionState ?? meeting.completionState,
            }
          : meeting,
      );

      const nextCurrentMeeting =
        state.currentMeeting?.id === meetingId
          ? {
              ...state.currentMeeting,
              status,
              processingPhase:
                phase ?? (status === 'completed' ? null : state.currentMeeting.processingPhase),
              needsAttention:
                needsAttention ?? state.currentMeeting.needsAttention,
              completionState:
                completionState ?? state.currentMeeting.completionState,
            }
          : state.currentMeeting;

      return {
        meetings: nextMeetings,
        currentMeeting: nextCurrentMeeting,
      };
    });
  },

  applyResultRegenerateUpdate: ({ meetingId, phase }) => {
    set((state) => {
      const nextProcessingPhase =
        phase === 'started' ? MeetingProcessingPhase.REGENERATING : null;

      const nextMeetings = state.meetings.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              processingPhase: nextProcessingPhase,
            }
          : meeting,
      );

      const nextCurrentMeeting =
        state.currentMeeting?.id === meetingId
          ? {
              ...state.currentMeeting,
              processingPhase: nextProcessingPhase,
            }
          : state.currentMeeting;

      return {
        meetings: nextMeetings,
        currentMeeting: nextCurrentMeeting,
      };
    });
  },
}));
