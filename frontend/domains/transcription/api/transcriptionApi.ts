import { apiClient } from '@/lib/api/client';
import type { TranscriptSegment } from '../types/transcription.types';

export const transcriptionApi = {
  // 전사 세그먼트 목록 조회
  list: async (meetingId: string): Promise<TranscriptSegment[]> => {
    const response = await apiClient.get<{ data: { segments: TranscriptSegment[] } }>(
      `/api/v1/meetings/${meetingId}/transcripts`
    );
    return response.data.segments;
  },
};
