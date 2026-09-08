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

/** GET /api/v1/meetings/stats — 페이지네이션과 무관한 소유자 전체 기준 집계 */
export interface MeetingStats {
  totalMeetings: number;
  recordingMeetings: number;
  processingMeetings: number;
  completedMeetings: number;
  /** 종료된 회의의 총 진행 시간(초) */
  totalTranscribedSeconds: number;
  /** 최근 7일, 오래된 날부터 오늘까지 */
  weekly: Array<{ date: string; count: number }>;
}

export interface MeetingPage {
  meetings: Meeting[];
  /** 서버가 보유한 전체 개수 (deleted 제외) */
  total: number;
}
