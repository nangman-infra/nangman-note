import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';
import { BedrockService } from './bedrock.service';

describe('BedrockService', () => {
  it('builds deterministic inference config from validated env', async () => {
    const send = jest.fn().mockResolvedValue({
      output: { message: { content: [{ text: '# result' }] } },
      stopReason: 'end_turn',
    });
    const mockClient = { send } as unknown as BedrockRuntimeClient;
    const awsClientFactory = {
      createBedrockRuntimeClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as AwsClientFactory;

    const configMap = {
      PORT: 9999,
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
      AWS_REGION: 'ap-northeast-2',
      AWS_PROFILE: 'default',
      AWS_TRANSCRIBE_JOB_PREFIX: 'nangman-note',
      AWS_TRANSCRIBE_LANGUAGE_CODE: 'ko-KR',
      AWS_TRANSCRIBE_OUTPUT_BUCKET: '',
      AWS_TRANSCRIBE_MEDIA_FORMAT: 'webm',
      AWS_S3_AUDIO_BUCKET: '',
      AWS_S3_AUDIO_KEY_PREFIX: 'meeting-audio',
      AWS_BEDROCK_MODEL_ID: 'amazon.nova-pro-v1:0',
      AWS_BEDROCK_MAX_TOKENS: 4096,
      AWS_BEDROCK_TEMPERATURE: 0,
      LOG_LEVEL: 'debug',
      CORS_ORIGIN: 'http://localhost:3000',
    } as unknown as AppEnv;
    const configService = {
      get: jest.fn(
        (key: string) => (configMap as unknown as Record<string, unknown>)[key],
      ),
    } as unknown as ConfigService<AppEnv, true>;

    const service = new BedrockService(configService, awsClientFactory);

    await service.generateMeetingResult({
      promptContent: '테스트 프롬프트',
      noteContent: '테스트 노트',
      transcriptText: '테스트 전사',
      meetingTitle: '테스트 회의',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const callArgs = send.mock.calls as unknown[][];
    const firstCall = callArgs[0];
    expect(firstCall).toBeDefined();
    const command = firstCall[0] as ConverseCommand;
    const input = (command as unknown as { input: Record<string, unknown> })
      .input;
    const inferenceConfig = input.inferenceConfig as Record<string, unknown>;

    expect(input.modelId).toBe('amazon.nova-pro-v1:0');
    expect(inferenceConfig.maxTokens).toBe(4096);
    expect(inferenceConfig.temperature).toBe(0);
    expect(inferenceConfig.topP).toBe(1);
  });
});
