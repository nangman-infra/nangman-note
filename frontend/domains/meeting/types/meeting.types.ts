import { MeetingCompletionState } from './meeting-completion-state.enum';
import { MeetingProcessingPhase } from './meeting-processing-phase.enum';

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
  agenda?: string;
  promptId: string;
  status: MeetingStatus;
  processingPhase?: MeetingProcessingPhase | null;
  needsAttention?: boolean;
  completionState?: MeetingCompletionState | null;
  transcriptionMode: MeetingTranscriptionMode;
  /** 전사 언어 코드 (e.g. 'ko-KR'). undefined면 자동 감지 */
  languageCode?: string;
  /** 번역 대상 언어 (e.g. 'ko'). undefined면 번역 안 함 */
  translateTargetLanguage?: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateMeetingDto {
  title?: string;
  agenda?: string;
  promptId?: string; // 선택 사항, 기본값: prompt_default_meeting
  transcriptionMode?: MeetingTranscriptionMode;
  languageCode?: string;
  translateTargetLanguage?: string;
}

export interface SearchResult {
  meetingId: string;
  title?: string;
  status: MeetingStatus;
  processingPhase?: MeetingProcessingPhase | null;
  needsAttention?: boolean;
  completionState?: MeetingCompletionState | null;
  transcriptionMode: MeetingTranscriptionMode;
  matchedIn: 'title' | 'result' | 'transcript' | 'note';
  snippet: string;
  startedAt: string;
}
