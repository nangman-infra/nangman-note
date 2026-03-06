export interface TranscriptSegment {
  id: string;
  meetingId: string;
  startTime: number; // 초
  endTime: number; // 초
  text: string;
  confidence: number; // 0-1
  translatedText?: string;
  detectedLanguage?: string;
  speakerLabel?: string;
  createdAt: string;
}

/** 실시간 전사 WebSocket 이벤트 페이로드 */
export interface RealtimeTranscriptContentPayload {
  type: 'partial' | 'final';
  resultId: string;
  text: string;
  translatedText?: string;
  translationPending?: boolean;
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
  speakerLabel?: string;
}

export interface RealtimeTranslationPayload {
  type: 'translation';
  resultId: string;
  translatedText?: string;
  failed?: boolean;
}

export type RealtimeTranscriptPayload =
  | RealtimeTranscriptContentPayload
  | RealtimeTranslationPayload;

export enum TranscriptionJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TranscriptionJob {
  id: string;
  meetingId: string;
  provider: string;
  providerJobId: string;
  status: TranscriptionJobStatus;
  mediaUri: string;
  languageCode: string;
  transcriptUri?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
