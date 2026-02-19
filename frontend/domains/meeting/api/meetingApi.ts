import { apiClient } from '@/lib/api/client';
import type { Meeting, CreateMeetingDto, SearchResult } from '../types/meeting.types';

export const meetingApi = {
  // 회의 생성
  create: async (dto: CreateMeetingDto): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>('/api/v1/meetings', dto);
    return response.data;
  },

  // 회의 목록 조회
  list: async (params?: { page?: number; limit?: number }): Promise<Meeting[]> => {
    const response = await apiClient.get<{ data: { meetings: Meeting[] } }>(
      '/api/v1/meetings',
      { params }
    );
    return response.data.meetings;
  },

  // 회의 검색
  search: async (query: string, scope: string = 'all'): Promise<SearchResult[]> => {
    const response = await apiClient.get<{ data: { results: SearchResult[] } }>(
      '/api/v1/meetings/search',
      { params: { q: query, scope } }
    );
    return response.data.results;
  },

  // 회의 상세 조회
  get: async (id: string): Promise<Meeting> => {
    const response = await apiClient.get<{ data: Meeting }>(`/api/v1/meetings/${id}`);
    return response.data;
  },

  // 프롬프트 변경
  updatePrompt: async (id: string, promptId: string): Promise<Meeting> => {
    const response = await apiClient.patch<{ data: Meeting }>(
      `/api/v1/meetings/${id}`,
      { promptId }
    );
    return response.data;
  },

  // 회의 종료
  complete: async (id: string): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>(
      `/api/v1/meetings/${id}/complete`
    );
    return response.data;
  },

  // 회의 삭제
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/meetings/${id}`);
  },
};
