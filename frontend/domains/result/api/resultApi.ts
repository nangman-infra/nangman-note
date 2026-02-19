import { apiClient } from '@/lib/api/client';
import type { MeetingResult } from '../types/result.types';

export const resultApi = {
  // 회의록 조회
  get: async (meetingId: string): Promise<MeetingResult> => {
    const response = await apiClient.get<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result`
    );
    return response.data;
  },

  // 회의록 편집
  update: async (meetingId: string, content: string): Promise<MeetingResult> => {
    const response = await apiClient.patch<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result`,
      { content }
    );
    return response.data;
  },

  // 회의록 재생성 (프롬프트 변경)
  regenerate: async (meetingId: string, promptId: string): Promise<MeetingResult> => {
    const response = await apiClient.post<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result/regenerate`,
      { promptId }
    );
    return response.data;
  },

  // PDF 다운로드
  exportPDF: async (meetingId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/v1/meetings/${meetingId}/result/export?format=pdf`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};
