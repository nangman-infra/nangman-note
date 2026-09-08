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

  it('normalizes parameterized browser content types before signing uploads', async () => {
    jest.mocked(getSignedUrl).mockResolvedValue('https://upload.example');
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_AUDIO_BUCKET') return 'audio-bucket';
        if (key === 'AWS_S3_AUDIO_KEY_PREFIX') return 'audio';
        return undefined;
      }),
    };
    const service = new S3AudioService(
      configService as unknown as ConfigService<AppEnv, true>,
      {
        createS3Client: jest.fn().mockReturnValue({ send: jest.fn() }),
      } as unknown as AwsClientFactory,
    );

    const upload = await service.generateUploadUrl('meeting-1', {
      contentType: 'audio/webm;codecs=opus',
    });

    expect(upload.contentType).toBe('audio/webm');
    expect(upload.s3Key).toMatch(/\.webm$/u);
  });

  it('accepts managed media only under the requested meeting prefix', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_AUDIO_BUCKET') return 'audio-bucket';
        if (key === 'AWS_S3_AUDIO_KEY_PREFIX') return 'audio';
        return undefined;
      }),
    };
    const service = new S3AudioService(
      configService as unknown as ConfigService<AppEnv, true>,
      {
        createS3Client: jest.fn().mockReturnValue({ send: jest.fn() }),
      } as unknown as AwsClientFactory,
    );

    expect(
      service.isManagedMediaUriForMeeting(
        's3://audio-bucket/audio/meeting-1/file.webm',
        'meeting-1',
      ),
    ).toBe(true);
    expect(
      service.isManagedMediaUriForMeeting(
        's3://audio-bucket/audio/meeting-2/file.webm',
        'meeting-1',
      ),
    ).toBe(false);
  });

  it('returns false only for S3 not-found responses', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('missing key'), { code: 'NoSuchKey' }),
      );
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_AUDIO_BUCKET') return 'audio-bucket';
        if (key === 'AWS_S3_AUDIO_KEY_PREFIX') return 'audio';
        return undefined;
      }),
    };
    const service = new S3AudioService(
      configService as unknown as ConfigService<AppEnv, true>,
      {
        createS3Client: jest.fn().mockReturnValue({ send }),
      } as unknown as AwsClientFactory,
    );

    await expect(
      service.objectExists('audio-bucket', 'missing.webm'),
    ).resolves.toBe(false);
    await expect(
      service.objectExists('audio-bucket', 'missing-again.webm'),
    ).resolves.toBe(false);
  });

  it.each([
    Object.assign(new Error('forbidden'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    }),
    Object.assign(new Error('throttled'), {
      name: 'SlowDown',
      $metadata: { httpStatusCode: 503 },
    }),
    new Error('network unavailable'),
  ])('rethrows non-not-found S3 failures', async (failure) => {
    const send = jest.fn().mockRejectedValue(failure);
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_AUDIO_BUCKET') return 'audio-bucket';
        if (key === 'AWS_S3_AUDIO_KEY_PREFIX') return 'audio';
        return undefined;
      }),
    };
    const service = new S3AudioService(
      configService as unknown as ConfigService<AppEnv, true>,
      {
        createS3Client: jest.fn().mockReturnValue({ send }),
      } as unknown as AwsClientFactory,
    );

    await expect(
      service.objectExists('audio-bucket', 'unknown.webm'),
    ).rejects.toBe(failure);
  });
});
