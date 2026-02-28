import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  type TranscribeClient,
  type LanguageCode,
  type MediaFormat,
} from '@aws-sdk/client-transcribe';
import { AppEnv } from '../../../shared/config/env.validation';
import { AwsClientFactory } from '../../../shared/aws/aws-client.factory';
import {
  BatchTranscriptionProvider,
  SubmitBatchTranscriptionJobInput,
  SubmitBatchTranscriptionJobResult,
} from '../application/ports/batch-transcription-provider.port';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';

@Injectable()
export class AwsBatchTranscriptionProvider
  implements BatchTranscriptionProvider
{
  private readonly transcribeClient: TranscribeClient;
  private readonly jobPrefix: string;
  private readonly defaultLanguageCode: string;
  private readonly outputBucket: string;
  private readonly mediaFormat: string;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly awsClientFactory: AwsClientFactory,
  ) {
    this.transcribeClient = this.awsClientFactory.createTranscribeClient();
    this.jobPrefix = this.configService.get('AWS_TRANSCRIBE_JOB_PREFIX', {
      infer: true,
    });
    this.defaultLanguageCode = this.configService.get(
      'AWS_TRANSCRIBE_LANGUAGE_CODE',
      { infer: true },
    );
    this.outputBucket = this.configService.get('AWS_TRANSCRIBE_OUTPUT_BUCKET', {
      infer: true,
    });
    this.mediaFormat = this.configService.get('AWS_TRANSCRIBE_MEDIA_FORMAT', {
      infer: true,
    });
  }

  async submitBatchJob(
    input: SubmitBatchTranscriptionJobInput,
  ): Promise<SubmitBatchTranscriptionJobResult> {
    const providerJobId = this.buildJobName(input.meetingId);
    const languageCode = input.languageCode || this.defaultLanguageCode;

    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: providerJobId,
      LanguageCode: languageCode as LanguageCode,
      MediaFormat: this.mediaFormat as MediaFormat,
      Media: {
        MediaFileUri: input.mediaUri,
      },
      OutputBucketName: this.outputBucket || undefined,
      OutputKey: this.outputBucket
        ? `transcribe-output/${input.meetingId}/${providerJobId}.json`
        : undefined,
    });

    const response = await this.transcribeClient.send(command);
    const awsStatus =
      response.TranscriptionJob?.TranscriptionJobStatus ?? 'QUEUED';

    return {
      providerJobId,
      status: this.mapAwsStatus(awsStatus),
    };
  }

  async getJobStatus(providerJobId: string): Promise<{
    status: TranscriptionJobStatus;
    transcriptUri?: string;
    errorMessage?: string;
  }> {
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: providerJobId,
    });

    const response = await this.transcribeClient.send(command);
    const job = response.TranscriptionJob;

    if (!job) {
      return {
        status: TranscriptionJobStatus.FAILED,
        errorMessage: 'Transcription job not found',
      };
    }

    const status = this.mapAwsStatus(job.TranscriptionJobStatus ?? 'FAILED');
    const transcriptUri = job.Transcript?.TranscriptFileUri ?? undefined;
    const errorMessage = job.FailureReason ?? undefined;

    return { status, transcriptUri, errorMessage };
  }

  private buildJobName(meetingId: string): string {
    const normalized = meetingId
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 20);
    return `${this.jobPrefix}-${normalized}-${Date.now().toString(36)}`;
  }

  private mapAwsStatus(awsStatus: string): TranscriptionJobStatus {
    switch (awsStatus) {
      case 'COMPLETED':
        return TranscriptionJobStatus.COMPLETED;
      case 'FAILED':
        return TranscriptionJobStatus.FAILED;
      case 'IN_PROGRESS':
        return TranscriptionJobStatus.PROCESSING;
      case 'QUEUED':
      default:
        return TranscriptionJobStatus.QUEUED;
    }
  }
}