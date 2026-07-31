import { TranscriptionJobStatus } from '../../domain/transcription-job-status.enum';

export interface SubmitBatchTranscriptionJobInput {
  meetingId: string;
  mediaUri: string;
  languageCode: string;
}

export interface SubmitBatchTranscriptionJobResult {
  providerJobId: string;
  status: TranscriptionJobStatus;
}

export interface BatchTranscriptionJobStatus {
  status: TranscriptionJobStatus;
  transcriptUri?: string;
  errorMessage?: string;
}

export interface BatchTranscriptionProvider {
  submitBatchJob(
    input: SubmitBatchTranscriptionJobInput,
  ): Promise<SubmitBatchTranscriptionJobResult>;

  getJobStatus(providerJobId: string): Promise<BatchTranscriptionJobStatus>;
}

export const BATCH_TRANSCRIPTION_PROVIDER = Symbol(
  'BATCH_TRANSCRIPTION_PROVIDER',
);
