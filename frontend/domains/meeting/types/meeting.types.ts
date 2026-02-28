export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
}

export enum MeetingTranscriptionMode {
  BATCH = 'batch',
  REALTIME = 'realtime',
}

export interface Meeting {
  id: string;
  title?: string;
  promptId: string;
  status: MeetingStatus;
  transcriptionMode: MeetingTranscriptionMode;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateMeetingDto {
  title?: string;
  promptId?: string; // 선택 사항, 기본값: prompt_default_meeting
  transcriptionMode?: MeetingTranscriptionMode;
}

export interface SearchResult {
  meetingId: string;
  title?: string;
  status: MeetingStatus;
  transcriptionMode: MeetingTranscriptionMode;
  matchedIn: 'title' | 'result' | 'transcript' | 'note';
  snippet: string;
  startedAt: string;
}
