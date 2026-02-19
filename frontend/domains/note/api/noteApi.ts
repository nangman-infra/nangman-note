import { apiClient } from '@/lib/api/client';
import type { Note } from '../types/note.types';

export const noteApi = {
  // 노트 저장 (자동 저장)
  save: async (meetingId: string, content: string): Promise<Note> => {
    const response = await apiClient.put<{ data: Note }>(
      `/api/v1/meetings/${meetingId}/note`,
      { content }
    );
    return response.data;
  },

  // 노트 조회
  get: async (meetingId: string): Promise<Note> => {
    const response = await apiClient.get<{ data: Note }>(
      `/api/v1/meetings/${meetingId}/note`
    );
    return response.data;
  },
};
