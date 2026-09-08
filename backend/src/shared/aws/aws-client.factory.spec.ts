import { ConfigService } from '@nestjs/config';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentity } from '@aws-sdk/types';
import type { AppEnv } from '../config/env.validation';
import { AwsClientFactory } from './aws-client.factory';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: jest.fn(),
}));

type CredentialsProvider = () => Promise<AwsCredentialIdentity>;

function createFactory(profile: string, provider: CredentialsProvider) {
  jest.mocked(fromNodeProviderChain).mockReturnValue(provider);
  const config = {
    get: jest.fn((key: keyof AppEnv) => {
      if (key === 'AWS_REGION') return 'ap-northeast-2';
      if (key === 'AWS_PROFILE') return profile;
      return undefined;
    }),
  } as unknown as ConfigService<AppEnv, true>;

  return new AwsClientFactory(config);
}

describe('AwsClientFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['', '   ', 'default'])(
    'does not force the shared config profile for %p',
    (profile) => {
      createFactory(profile, jest.fn());

      expect(fromNodeProviderChain).toHaveBeenCalledWith(undefined);
    },
  );

  it('passes an explicitly configured non-default profile', () => {
    createFactory(' local-admin ', jest.fn());

    expect(fromNodeProviderChain).toHaveBeenCalledWith({
      profile: 'local-admin',
    });
  });

  it('retries credential warmup after a rejected attempt', async () => {
    const credentials: AwsCredentialIdentity = {
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };
    const provider = jest
      .fn<ReturnType<CredentialsProvider>, Parameters<CredentialsProvider>>()
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValue(credentials);
    const factory = createFactory('default', provider);

    await expect(factory.warmCredentials()).rejects.toThrow(
      'temporary provider failure',
    );
    await expect(factory.warmCredentials()).resolves.toBeUndefined();

    expect(provider).toHaveBeenCalledTimes(2);
  });
});
