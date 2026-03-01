/**
 * 실시간 전사 세션의 결과 이벤트
 */
export interface StreamingTranscriptEvent {
  /** partial(진행중) 또는 final(확정) */
  type: 'partial' | 'final';
  /** 전사된 텍스트 */
  text: string;
  /** 세그먼트 시작 시간 (초, Transcribe 기준) */
  startTime: number;
  /** 세그먼트 종료 시간 (초, Transcribe 기준) */
  endTime: number;
  /** 결과 ID (Transcribe ResultId) */
  resultId: string;
  /** 감지된 언어 코드 (IdentifyLanguage 사용 시) */
  detectedLanguage?: string;
}

/**
 * 실시간 전사 세션 시작 옵션
 */
export interface StreamingSessionOptions {
  meetingId: string;
  /** Transcribe 언어 코드 (e.g. 'ko-KR', 'en-US'). null이면 자동 감지 */
  languageCode: string | null;
  /** 자동 감지 시 후보 언어 목록 */
  languageOptions?: string[];
  /** PCM 샘플 레이트 (기본 16000) */
  sampleRate?: number;
  /** 결과 콜백 */
  onTranscript: (event: StreamingTranscriptEvent) => void;
  /** 에러 콜백 */
  onError: (error: Error) => void;
  /** 세션 종료 콜백 */
  onClose: () => void;
}

/**
 * 실시간 전사 Provider 포트
 */
export interface StreamingTranscriptionProvider {
  /** 세션 시작 */
  startSession(options: StreamingSessionOptions): Promise<void>;
  /** 오디오 청크 전달 (PCM 16-bit LE binary) */
  feedAudio(meetingId: string, chunk: Buffer): void;
  /** 세션 종료 */
  stopSession(meetingId: string): Promise<void>;
  /** 세션 활성 여부 확인 */
  hasActiveSession(meetingId: string): boolean;
}

export const STREAMING_TRANSCRIPTION_PROVIDER = Symbol(
  'STREAMING_TRANSCRIPTION_PROVIDER',
);