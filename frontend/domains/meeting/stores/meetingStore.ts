import { create } from 'zustand';
import { meetingApi } from '../api/meetingApi';
import type { Meeting, CreateMeetingDto } from '../types/meeting.types';

interface MeetingState {
  // 현재 회의
  currentMeeting: Meeting | null;
  isRecording: boolean;
  elapsedTime: number;

  // 회의 목록
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;

  // Actions
  startMeeting: (dto: CreateMeetingDto) => Promise<void>;
  endMeeting: () => Promise<void>;
  updatePrompt: (promptId: string) => Promise<void>;
  fetchMeetings: () => Promise<void>;
  searchMeetings: (query: string, scope?: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
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
      set({ 
        currentMeeting: meeting, 
        isRecording: true,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to start meeting',
        isLoading: false 
      });
    }
  },

  endMeeting: async () => {
    const { currentMeeting } = get();
    if (!currentMeeting) return;

    try {
      set({ isLoading: true, error: null });
      await meetingApi.complete(currentMeeting.id);
      set({ isRecording: false, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to end meeting',
        isLoading: false 
      });
    }
  },

  updatePrompt: async (promptId) => {
    const { currentMeeting } = get();
    if (!currentMeeting) return;

    try {
      set({ isLoading: true, error: null });
      const updated = await meetingApi.updatePrompt(currentMeeting.id, promptId);
      set({ currentMeeting: updated, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update prompt',
        isLoading: false 
      });
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
        isLoading: false 
      });
    }
  },

  searchMeetings: async (query, scope = 'all') => {
    try {
      set({ isLoading: true, error: null });
      const results = await meetingApi.search(query, scope);
      // SearchResult를 Meeting 형식으로 변환 (간단히 처리)
      set({ meetings: results as any, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search meetings',
        isLoading: false 
      });
    }
  },

  deleteMeeting: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await meetingApi.delete(id);
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
        isLoading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete meeting',
        isLoading: false 
      });
    }
  },

  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },
}));
