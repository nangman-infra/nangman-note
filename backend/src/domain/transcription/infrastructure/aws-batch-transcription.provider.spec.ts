import { ConfigService } from '@nestjs/config';
import {
  StartTranscriptionJobCommand,
  type TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { AwsClientFactory } from '../../../shared/aws/aws-client.factory';
import { AppEnv } from '../../../shared/config/env.validation';
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
    });

    const command = send.mock.calls[0]?.[0] as StartTranscriptionJobCommand;
    const input = (
      command as unknown as {
        input: {
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
  });
});
