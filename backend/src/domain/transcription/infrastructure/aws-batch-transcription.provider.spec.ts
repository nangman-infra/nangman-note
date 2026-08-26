import { ConfigService } from '@nestjs/config';
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  type TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { AwsClientFactory } from '../../../shared/aws/aws-client.factory';
import { AppEnv } from '../../../shared/config/env.validation';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { AwsBatchTranscriptionProvider } from './aws-batch-transcription.provider';

describe('AwsBatchTranscriptionProvider', () => {
  it('uses configured max speaker labels for batch diarization', async () => {
    const send = jest.fn().mockResolvedValue({
      TranscriptionJob: {
        TranscriptionJobStatus: 'QUEUED',
      },
    });
    const client = { send } as unknown as TranscribeClient;
    const configMap: Partial<AppEnv> = {
      AWS_TRANSCRIBE_JOB_PREFIX: 'nangman-note',
      AWS_TRANSCRIBE_LANGUAGE_CODE: 'ko-KR',
      AWS_TRANSCRIBE_OUTPUT_BUCKET: 'transcript-bucket',
      AWS_TRANSCRIBE_MEDIA_FORMAT: 'webm',
      AWS_TRANSCRIBE_MAX_SPEAKER_LABELS: 6,
    };
    const configService = {
      get: jest.fn(
        (key: string) => (configMap as Record<string, unknown>)[key],
      ),
    } as unknown as ConfigService<AppEnv, true>;
    const awsClientFactory = {
      createTranscribeClient: jest.fn().mockReturnValue(client),
    } as unknown as AwsClientFactory;

    const provider = new AwsBatchTranscriptionProvider(
      configService,
      awsClientFactory,
    );

    await provider.submitBatchJob({
      meetingId: 'meeting-1',
      mediaUri: 's3://audio-bucket/meeting-1/audio.webm',
      languageCode: 'ko-KR',
      providerJobId: 'durable-job-id',
    });

    const command = send.mock.calls[0]?.[0] as StartTranscriptionJobCommand; // eslint-disable-line @typescript-eslint/no-unsafe-member-access
    const input = (
      command as unknown as {
        input: {
          TranscriptionJobName?: string;
          Settings?: {
            ShowSpeakerLabels?: boolean;
            MaxSpeakerLabels?: number;
          };
        };
      }
    ).input;

    expect(input.Settings).toEqual(
      expect.objectContaining({
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 6,
      }),
    );
    expect(input.TranscriptionJobName).toBe('durable-job-id');
  });

  it('treats a deterministic-name conflict as an idempotent submission', async () => {
    const conflict = Object.assign(new Error('already exists'), {
      name: 'ConflictException',
    });
    const send = jest
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      });
    const client = { send } as unknown as TranscribeClient;
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, unknown> = {
          AWS_TRANSCRIBE_JOB_PREFIX: 'nangman-note',
          AWS_TRANSCRIBE_LANGUAGE_CODE: 'ko-KR',
          AWS_TRANSCRIBE_OUTPUT_BUCKET: 'transcript-bucket',
          AWS_TRANSCRIBE_MEDIA_FORMAT: 'webm',
          AWS_TRANSCRIBE_MAX_SPEAKER_LABELS: 6,
        };
        return config[key];
      }),
    } as unknown as ConfigService<AppEnv, true>;
    const awsClientFactory = {
      createTranscribeClient: jest.fn().mockReturnValue(client),
    } as unknown as AwsClientFactory;
    const provider = new AwsBatchTranscriptionProvider(
      configService,
      awsClientFactory,
    );

    const result = await provider.submitBatchJob({
      meetingId: 'meeting-1',
      mediaUri: 's3://audio-bucket/meeting-1/audio.webm',
      languageCode: 'ko-KR',
      providerJobId: 'durable-job-id',
    });

    const commands = send.mock.calls as unknown[][];
    expect(commands[0]?.[0]).toBeInstanceOf(StartTranscriptionJobCommand);
    expect(commands[1]?.[0]).toBeInstanceOf(GetTranscriptionJobCommand);
    expect(result).toEqual({
      providerJobId: 'durable-job-id',
      status: TranscriptionJobStatus.PROCESSING,
    });
  });
});
