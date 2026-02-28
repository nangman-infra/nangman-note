import { create } from 'zustand';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { meetingApi } from '../api/meetingApi';
import {
  MeetingStatus,
  MeetingTranscriptionMode,
  type CreateMeetingDto,
  type Meeting,
  type SearchResult,
} from '../types/meeting.types';

interface MeetingState {
  currentMeeting: Meeting | null;
  isRecording: boolean;
  elapsedTime: number;
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  startMeeting: (dto: CreateMeetingDto) => Promise<Meeting | null>;
  endMeeting: (options?: { skipTranscription?: boolean }) => Promise<boolean>;
  updatePrompt: (promptId: string) => Promise<Meeting | null>;
  fetchMeetings: () => Promise<void>;
  searchMeetings: (query: string, scope?: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
}

function mapSearchResultToMeeting(result: SearchResult): Meeting {
  return {
    id: result.meetingId,
    title: result.title || result.snippet,
    promptId: DEFAULT_PROMPT_ID,
    status: MeetingStatus.COMPLETED,
    transcriptionMode: MeetingTranscriptionMode.BATCH,
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

  fetchMeetings: async () => {
    try {
      set({ isLoading: true, error: null });
      const meetings = await meetingApi.list();
      set({ meetings, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch meetings',
        isLoading: false,
      });
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
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete meeting',
        isLoading: false,
      });
    }
  },

  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },
}));
