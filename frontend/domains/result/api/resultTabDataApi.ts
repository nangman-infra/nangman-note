import { apiClient } from '@/lib/api/client';

export interface ResultTabTranscriptSegment {
  id: string;
  meetingId: string;
  startTime: number;
  endTime: number;
  text: string;
  speakerLabel?: string;
}

interface TranscriptListResponse {
  data: {
    segments: ResultTabTranscriptSegment[];
  };
}

interface NoteResponse {
  data: {
    content: string;
  };
}

export const resultTabDataApi = {
  listTranscripts: async (
    meetingId: string,
  ): Promise<ResultTabTranscriptSegment[]> => {
    const response = await apiClient.get<TranscriptListResponse>(
      `/api/v1/meetings/${meetingId}/transcripts`,
    );
    return response.data.data.segments;
  },

  getNoteContent: async (meetingId: string): Promise<string> => {
    const response = await apiClient.get<NoteResponse>(
      `/api/v1/meetings/${meetingId}/note`,
    );
    return response.data.data.content;
  },
};
