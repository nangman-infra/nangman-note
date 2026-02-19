export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
}

export interface Meeting {
  id: string;
  title?: string;
  promptId: string;
  status: MeetingStatus;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingDto {
  title?: string;
  promptId?: string; // 선택 사항, 기본값: prompt_default_meeting
}

export interface SearchResult {
  meetingId: string;
  title?: string;
  matchedIn: 'title' | 'result' | 'transcript' | 'note';
  snippet: string;
  startedAt: string;
}
