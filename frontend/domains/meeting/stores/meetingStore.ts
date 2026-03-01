import { create } from 'zustand';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { meetingApi } from '../api/meetingApi';
import {
  type CreateMeetingDto,
  type Meeting,
  type SearchResult,
} from '../types/meeting.types';

interface MeetingState {
  currentMeeting: Meeting | null;
  isRecording: boolean;
  elapsedTime: number;
  meetings: Meeting[];
  trashMeetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  startMeeting: (dto: CreateMeetingDto) => Promise<Meeting | null>;
  endMeeting: (options?: { skipTranscription?: boolean }) => Promise<boolean>;
  updatePrompt: (promptId: string) => Promise<Meeting | null>;
  fetchMeetings: (options?: { silent?: boolean }) => Promise<void>;
  fetchTrashMeetings: (options?: { silent?: boolean }) => Promise<void>;
  searchMeetings: (query: string, scope?: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<boolean>;
  restoreMeeting: (id: string) => Promise<boolean>;
  purgeMeeting: (id: string) => Promise<boolean>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
}

function mapSearchResultToMeeting(result: SearchResult): Meeting {
  return {
    id: result.meetingId,
    title: result.title || result.snippet,
    promptId: DEFAULT_PROMPT_ID,
    status: result.status,
    transcriptionMode: result.transcriptionMode,
    startedAt: result.startedAt,
    createdAt: result.startedAt,
    updatedAt: result.startedAt,
  };
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  currentMeeting: null,
  isRecording: false,
  elapsedTime: 0,
  meetings: [],
  trashMeetings: [],
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
      const meetings = await meetingApi.list();
      set((state) => ({
        meetings,
        error: null,
        isLoading: shouldShowLoading ? false : state.isLoading,
      }));
    } catch (error) {
      if (shouldShowLoading) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch meetings',
          isLoading: false,
        });
      }
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

  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },
}));
