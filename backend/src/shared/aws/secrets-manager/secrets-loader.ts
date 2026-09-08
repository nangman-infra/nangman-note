/**
 * 애플리케이션 부트스트랩 전에 AWS Secrets Manager에서 민감정보를 로딩하여
 * process.env에 주입하는 프리-부트스트랩 로더.
 *
 * 암호화 키는 ConfigService/EncryptionService가 시작 시점에 snapshot으로 읽는다.
 * 따라서 실행 중 process.env만 바꾸는 가짜 hot rotation은 금지하고, Secrets Manager
 * rotation은 새 task/process를 재시작할 때 적용한다. Key rotation 중 기존 데이터는
 * ENCRYPTION_KEYS keyring에 이전 key ID를 유지해야 한다.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

let smClient: SecretsManagerClient | null = null;

function getClient(): SecretsManagerClient {
  if (!smClient) {
    const region = process.env.AWS_REGION || 'ap-northeast-2';
    const profile = process.env.AWS_PROFILE?.trim();

    smClient = new SecretsManagerClient({
      region,
      credentials: fromNodeProviderChain(
        profile && profile !== 'default' ? { profile } : undefined,
      ),
    });
  }
  return smClient;
}

async function fetchSecret(secretId: string): Promise<string> {
  const client = getClient();
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  return response.SecretString ?? '';
}

interface SecretMapping {
  /** process.env에서 시크릿 ID를 읽을 키 (예: SECRET_ENCRYPTION_KEY_ID) */
  secretIdEnvKey: string;
  /** 가져온 값을 주입할 process.env 키(들) */
  inject: SecretInjection;
}

type SecretInjection =
  | { type: 'plain'; envKey: string }
  | { type: 'json'; fields: { jsonKey: string; envKey: string }[] };

const SECRET_MAPPINGS: SecretMapping[] = [
  {
    secretIdEnvKey: 'SECRET_ENCRYPTION_KEY_ID',
    inject: { type: 'plain', envKey: 'ENCRYPTION_KEY' },
  },
  {
    secretIdEnvKey: 'SECRET_ENCRYPTION_KEYS_ID',
    inject: { type: 'plain', envKey: 'ENCRYPTION_KEYS' },
  },
];

async function loadAndInjectSecret(mapping: SecretMapping): Promise<void> {
  const secretId = process.env[mapping.secretIdEnvKey];
  if (!secretId) {
    return;
  }

  // ECS/container injection 또는 앞선 bootstrap 값이 있으면 절대 runtime 교체하지 않는다.
  if (mapping.inject.type === 'plain') {
    if (process.env[mapping.inject.envKey]) {
      return;
    }
  } else if (
    mapping.inject.fields.every((field) => process.env[field.envKey])
  ) {
    return;
  }

  const raw = await fetchSecret(secretId);

  if (mapping.inject.type === 'plain') {
    process.env[mapping.inject.envKey] = raw;
  } else {
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const field of mapping.inject.fields) {
      if (!process.env[field.envKey]) {
        process.env[field.envKey] = parsed[field.jsonKey] ?? '';
      }
    }
  }
}

/**
 * 애플리케이션 부트스트랩 전 한 번 호출한다. 암호화 key/keyring rotation은
 * process.env hot reload가 아니라 rolling restart로 적용해야 한다.
 */
export async function loadSecrets(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv !== 'production') {
    return;
  }

  const hasAnySecretId = SECRET_MAPPINGS.some(
    (mapping) => !!process.env[mapping.secretIdEnvKey],
  );
  if (!hasAnySecretId) {
    return;
  }

  console.log('[SecretsLoader] Loading secrets from AWS Secrets Manager...');

  const results = await Promise.allSettled(
    SECRET_MAPPINGS.map((mapping) => loadAndInjectSecret(mapping)),
  );
  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed.length > 0) {
    for (const failure of failed) {
      console.error('[SecretsLoader] Secret load failed:', failure.reason);
    }
    throw new Error(
      `[SecretsLoader] Failed to load ${failed.length} secret(s). Aborting startup.`,
    );
  }

  console.log(
    `[SecretsLoader] Successfully loaded ${results.length - failed.length} secret(s).`,
  );
}

/** 테스트 격리/graceful shutdown compatibility hook. */
export function stopSecretsRefresh(): void {
  smClient = null;
}
