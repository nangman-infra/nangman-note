export interface TranscriptSegment {
  id: string;
  meetingId: string;
  startTime: number; // 초
  endTime: number; // 초
  text: string;
  confidence: number; // 0-1
  createdAt: string;
}

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
