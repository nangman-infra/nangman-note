import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { loadSecrets, stopSecretsRefresh } from './secrets-loader';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetSecretValueCommand: jest
    .fn()
    .mockImplementation((input: unknown): unknown => input),
}));

jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: jest.fn().mockReturnValue(jest.fn()),
}));

describe('secrets-loader', () => {
  const originalEnv = process.env;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      AWS_PROFILE: 'default',
      SECRET_ENCRYPTION_KEY_ID: 'prod/encryption-key',
    };
    delete process.env.ENCRYPTION_KEY;
    delete process.env.SECRET_ENCRYPTION_KEYS_ID;
    delete process.env.ENCRYPTION_KEYS;
    mockSend.mockReset();
    jest.mocked(fromNodeProviderChain).mockClear();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    stopSecretsRefresh();
  });

  afterEach(() => {
    stopSecretsRefresh();
    process.env = originalEnv;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('loads an encryption secret once at startup without scheduling hot reload', async () => {
    const secret = 'a'.repeat(64);
    mockSend.mockResolvedValue({ SecretString: secret });
    const intervalSpy = jest.spyOn(global, 'setInterval');

    await loadSecrets();

    expect(process.env.ENCRYPTION_KEY).toBe(secret);
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(fromNodeProviderChain).toHaveBeenCalledWith(undefined);
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
  });

  it('does not overwrite a value already injected into the running process', async () => {
    process.env.ENCRYPTION_KEY = 'existing-startup-value';
    mockSend.mockResolvedValue({ SecretString: 'rotated-value' });

    await loadSecrets();

    expect(process.env.ENCRYPTION_KEY).toBe('existing-startup-value');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
