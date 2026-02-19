import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from '../../../shared/config/env.validation';
import {
  BatchTranscriptionProvider,
  SubmitBatchTranscriptionJobInput,
  SubmitBatchTranscriptionJobResult,
} from '../application/ports/batch-transcription-provider.port';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';

@Injectable()
export class AwsBatchTranscriptionProvider implements BatchTranscriptionProvider {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  submitBatchJob(
    input: SubmitBatchTranscriptionJobInput,
  ): Promise<SubmitBatchTranscriptionJobResult> {
    const region = this.configService.get('AWS_REGION', { infer: true });
    const profile = this.configService.get('AWS_PROFILE', { infer: true });
    const jobPrefix = this.configService.get('AWS_TRANSCRIBE_JOB_PREFIX', {
      infer: true,
    });
    const defaultLanguageCode = this.configService.get(
      'AWS_TRANSCRIBE_LANGUAGE_CODE',
      { infer: true },
    );
    const providerJobId = [
      jobPrefix,
      this.normalizeMeetingId(input.meetingId),
      Date.now().toString(36),
    ].join('-');

    // NOTE: AWS StartTranscriptionJob integration is intentionally deferred.
    // This provider reserves a stable contract so we can wire the async worker
    // and credentialed SDK call without changing API/domain contracts again.
    if (!region || !profile || !defaultLanguageCode) {
      throw new Error('AWS region/profile configuration is invalid');
    }

    return Promise.resolve({
      providerJobId,
      status: TranscriptionJobStatus.QUEUED,
    });
  }

  private normalizeMeetingId(meetingId: string): string {
    return meetingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  }
}
