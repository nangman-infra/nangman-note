import { MeetingCompletionState } from './meeting-completion-state.enum';
import { MeetingProcessingPhase } from './meeting-processing-phase.enum';
import { MeetingTranscriptionMode } from '@/lib/transcription/transcriptionMode';

export { MeetingTranscriptionMode } from '@/lib/transcription/transcriptionMode';

export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
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
  /** 검색 결과로 매핑된 경우: 어느 필드에서 매치됐는지 */
  searchMatchedIn?: 'title' | 'result' | 'transcript' | 'note';
  /** 검색 결과로 매핑된 경우: 매치 문맥 스니펫 */
  searchSnippet?: string;
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
