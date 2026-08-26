import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';
import { S3AudioService } from './s3.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3AudioService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates distinct cryptographically randomized keys in the same millisecond', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_777_000_000_000);
    jest.mocked(getSignedUrl).mockResolvedValue('https://upload.example');
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_AUDIO_BUCKET') return 'audio-bucket';
        if (key === 'AWS_S3_AUDIO_KEY_PREFIX') return 'audio';
        return undefined;
      }),
    };
    const awsClientFactory = {
      createS3Client: jest.fn().mockReturnValue({ send: jest.fn() }),
    };
    const service = new S3AudioService(
      configService as unknown as ConfigService<AppEnv, true>,
      awsClientFactory as unknown as AwsClientFactory,
    );

    const [first, second] = await Promise.all([
      service.generateUploadUrl('meeting-1'),
      service.generateUploadUrl('meeting-1'),
    ]);

    expect(first.s3Key).not.toBe(second.s3Key);
    expect(first.s3Key).toMatch(
      /^audio\/meeting-1\/1777000000000-[0-9a-f-]{36}\.webm$/,
    );
  });
});
