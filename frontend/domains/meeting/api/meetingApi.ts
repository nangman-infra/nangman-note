import { apiClient } from '@/lib/api/client';
import type { Meeting, CreateMeetingDto, SearchResult } from '../types/meeting.types';
import { MeetingTranscriptionMode } from '../types/meeting.types';

interface CompleteMeetingOptions {
  skipTranscription?: boolean;
  markAttentionRequired?: boolean;
}

export const meetingApi = {
  // 회의 생성
  create: async (dto: CreateMeetingDto): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>('/api/v1/meetings', dto);
    return response.data.data;
  },

  // 회의 목록 조회
  list: async (params?: { page?: number; limit?: number }): Promise<Meeting[]> => {
    const response = await apiClient.get<{ data: { meetings: Meeting[] } }>(
      '/api/v1/meetings',
      { params }
    );
    return response.data.data.meetings;
  },

  // 휴지통 회의 목록 조회
  listTrash: async (params?: { page?: number; limit?: number }): Promise<Meeting[]> => {
    const response = await apiClient.get<{ data: { meetings: Meeting[] } }>(
      '/api/v1/meetings/trash',
      { params }
    );
    return response.data.data.meetings;
  },

  // 전체 회의 데이터 내보내기 (노트·결과·전사 포함 JSON)
  exportAll: async (): Promise<{
    exportedAt: string;
    meetingCount: number;
    meetings: Array<Record<string, unknown>>;
  }> => {
    const response = await apiClient.get<{
      data: {
        exportedAt: string;
        meetingCount: number;
        meetings: Array<Record<string, unknown>>;
      };
    }>('/api/v1/meetings/export', { timeout: 120_000 });
    return response.data.data;
  },

  // 회의 검색
  search: async (query: string, scope: string = 'all'): Promise<SearchResult[]> => {
    const response = await apiClient.get<{ data: { results: SearchResult[] } }>(
      '/api/v1/meetings/search',
      { params: { q: query, scope } }
    );
    return response.data.data.results;
  },

  // 회의 상세 조회
  get: async (id: string): Promise<Meeting> => {
    const response = await apiClient.get<{ data: Meeting }>(`/api/v1/meetings/${id}`);
    return response.data.data;
  },

  // 회의 정보 업데이트 (제목 등)
  update: async (id: string, data: Partial<Pick<Meeting, 'title'>>): Promise<Meeting> => {
    const response = await apiClient.patch<{ data: Meeting }>(
      `/api/v1/meetings/${id}`,
      data,
    );
    return response.data.data;
  },

  // 프롬프트 변경
  updatePrompt: async (id: string, promptId: string): Promise<Meeting> => {
    const response = await apiClient.patch<{ data: Meeting }>(
      `/api/v1/meetings/${id}`,
      { promptId }
    );
    return response.data.data;
  },

  // 전사 모드 변경
  updateTranscriptionMode: async (
    id: string,
    transcriptionMode: MeetingTranscriptionMode,
  ): Promise<Meeting> => {
    const response = await apiClient.patch<{ data: Meeting }>(
      `/api/v1/meetings/${id}`,
      { transcriptionMode },
    );
    return response.data.data;
  },

  // 회의 종료
  complete: async (
    id: string,
    options?: CompleteMeetingOptions,
  ): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>(
      `/api/v1/meetings/${id}/complete`,
      options ?? {}
    );
    return response.data.data;
  },

  // 회의 삭제
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/meetings/${id}`);
  },

  // 휴지통 복구
  restore: async (id: string): Promise<void> => {
    await apiClient.post(`/api/v1/meetings/${id}/restore`);
  },

  // 영구 삭제
  purge: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/meetings/${id}/permanent`);
  },

  // 일괄 삭제 (soft delete)
  bulkDelete: async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
    const response = await apiClient.post<{ data: { succeeded: string[]; failed: string[] } }>(
      '/api/v1/meetings/bulk/delete',
      { ids },
    );
    return response.data.data;
  },

  // 일괄 복구
  bulkRestore: async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
    const response = await apiClient.post<{ data: { succeeded: string[]; failed: string[] } }>(
      '/api/v1/meetings/bulk/restore',
      { ids },
    );
    return response.data.data;
  },

  // 일괄 영구 삭제
  bulkPurge: async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
    const response = await apiClient.post<{ data: { succeeded: string[]; failed: string[] } }>(
      '/api/v1/meetings/bulk/purge',
      { ids },
    );
    return response.data.data;
  },
};
