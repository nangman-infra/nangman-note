import { apiClient } from '@/lib/api/client';
import type { TranscriptSegment, TranscriptionJob } from '../types/transcription.types';

export const transcriptionApi = {
  // 전사 세그먼트 목록 조회
  list: async (meetingId: string): Promise<TranscriptSegment[]> => {
    const response = await apiClient.get<{ data: { segments: TranscriptSegment[] } }>(
      `/api/v1/meetings/${meetingId}/transcripts`
    );
    return response.data.data.segments;
  },

  listJobs: async (meetingId: string): Promise<TranscriptionJob[]> => {
    const response = await apiClient.get<{ data: { jobs: TranscriptionJob[] } }>(
      `/api/v1/meetings/${meetingId}/transcripts/jobs`
    );
    return response.data.data.jobs;
  },

  queueBatchJob: async (
    meetingId: string,
    dto: { mediaUri: string; languageCode?: string }
  ): Promise<TranscriptionJob> => {
    const response = await apiClient.post<{ data: { job: TranscriptionJob } }>(
      `/api/v1/meetings/${meetingId}/transcripts/jobs`,
      dto
    );
    return response.data.data.job;
  },
};
