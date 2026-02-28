import { apiClient } from '@/lib/api/client';
import type { TranscriptSegment, TranscriptionJob } from '../types/transcription.types';

interface UploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  bucket: string;
  expiresInSeconds: number;
}

export const transcriptionApi = {
  // Presigned URL 생성 (오디오 업로드용)
  getUploadUrl: async (meetingId: string): Promise<UploadUrlResponse> => {
    const response = await apiClient.post<{ data: UploadUrlResponse }>(
      `/api/v1/meetings/${meetingId}/transcripts/upload-url`
    );
    return response.data.data;
  },

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
