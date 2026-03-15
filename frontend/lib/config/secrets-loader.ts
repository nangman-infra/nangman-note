/**
 * Next.js 서버사이드 전용 — AWS Secrets Manager에서 민감정보를 로딩하여
 * process.env에 주입하는 프리-부트스트랩 로더.
 *
 * instrumentation.ts의 register()에서 호출되어
 * auth.ts, proxy.ts 등이 process.env를 읽기 전에 값이 준비된다.
 *
 * 개발 환경에서는 .env.development 파일의 값을 그대로 사용하므로 스킵한다.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

/** 캐시된 시크릿 값과 만료 시각 */
interface CachedSecret {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const cache = new Map<string, CachedSecret>();

let smClient: SecretsManagerClient | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function getClient(): SecretsManagerClient {
  if (!smClient) {
    const region = process.env.AWS_REGION || 'ap-northeast-2';

    smClient = new SecretsManagerClient({
      region,
      credentials: fromNodeProviderChain(),
    });
  }
  return smClient;
}

async function fetchSecret(secretId: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(secretId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const client = getClient();
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);

  const value = response.SecretString ?? '';
  cache.set(secretId, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * 시크릿 ID → process.env 키 매핑 정의.
 */
interface SecretMapping {
  secretIdEnvKey: string;
  inject: SecretInjection;
}

type SecretInjection =
  | { type: 'plain'; envKey: string }
  | { type: 'json'; fields: { jsonKey: string; envKey: string }[] };

const SECRET_MAPPINGS: SecretMapping[] = [
  {
    secretIdEnvKey: 'SECRET_AUTH_ID',
    inject: {
      type: 'json',
      fields: [
        { jsonKey: 'NEXTAUTH_SECRET', envKey: 'NEXTAUTH_SECRET' },
        {
          jsonKey: 'AUTHENTIK_CLIENT_SECRET',
          envKey: 'AUTHENTIK_CLIENT_SECRET',
        },
      ],
    },
  },
];

async function loadAndInjectSecret(mapping: SecretMapping): Promise<void> {
  const secretId = process.env[mapping.secretIdEnvKey];
  if (!secretId) {
    return;
  }

  const raw = await fetchSecret(secretId);

  if (mapping.inject.type === 'plain') {
    if (!process.env[mapping.inject.envKey]) {
      process.env[mapping.inject.envKey] = raw;
    }
  } else {
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const field of mapping.inject.fields) {
      if (!process.env[field.envKey]) {
        process.env[field.envKey] = parsed[field.jsonKey] ?? '';
      }
    }
  }
}

async function refreshSecrets(): Promise<void> {
  cache.clear();

  for (const mapping of SECRET_MAPPINGS) {
    const secretId = process.env[mapping.secretIdEnvKey];
    if (!secretId) continue;

    try {
      const raw = await fetchSecret(secretId);

      if (mapping.inject.type === 'plain') {
        process.env[mapping.inject.envKey] = raw;
      } else {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const field of mapping.inject.fields) {
          process.env[field.envKey] = parsed[field.jsonKey] ?? '';
        }
      }
    } catch (error) {
      console.error(
        `[SecretsLoader:FE] Failed to refresh secret ${secretId}:`,
        error,
      );
    }
  }
}

/**
 * Next.js 서버 시작 시 호출.
 * 프로덕션 환경에서 Secrets Manager로부터 민감정보를 로딩하여 process.env에 주입한다.
 */
export async function loadSecrets(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv !== 'production') {
    return;
  }

  const hasAnySecretId = SECRET_MAPPINGS.some(
    (m) => !!process.env[m.secretIdEnvKey],
  );
  if (!hasAnySecretId) {
    return;
  }

  console.log(
    '[SecretsLoader:FE] Loading secrets from AWS Secrets Manager...',
  );

  const results = await Promise.allSettled(
    SECRET_MAPPINGS.map((m) => loadAndInjectSecret(m)),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    for (const f of failed) {
      console.error(
        '[SecretsLoader:FE] Secret load failed:',
        (f as PromiseRejectedResult).reason,
      );
    }
    throw new Error(
      `[SecretsLoader:FE] Failed to load ${failed.length} secret(s). Aborting startup.`,
    );
  }

  console.log(
    `[SecretsLoader:FE] Successfully loaded ${results.length - failed.length} secret(s).`,
  );

  // TTL 기반 주기적 갱신
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshSecrets();
    }, CACHE_TTL_MS);

    if (
      refreshTimer &&
      typeof refreshTimer === 'object' &&
      'unref' in refreshTimer
    ) {
      refreshTimer.unref();
    }
  }
}
