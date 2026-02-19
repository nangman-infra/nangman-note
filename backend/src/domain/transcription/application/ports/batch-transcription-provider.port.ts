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

export interface BatchTranscriptionProvider {
  submitBatchJob(
    input: SubmitBatchTranscriptionJobInput,
  ): Promise<SubmitBatchTranscriptionJobResult>;
}

export const BATCH_TRANSCRIPTION_PROVIDER = Symbol(
  'BATCH_TRANSCRIPTION_PROVIDER',
);
