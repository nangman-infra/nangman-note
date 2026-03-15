/**
 * 애플리케이션 부트스트랩 전에 AWS Secrets Manager에서 민감정보를 로딩하여
 * process.env에 주입하는 프리-부트스트랩 로더.
 *
 * NestJS ConfigModule이 process.env를 읽기 전에 실행되므로
 * 기존 env.validation.ts, encryption.service.ts 등 코드 변경 없이 동작한다.
 *
 * 개발 환경에서는 .env.development 파일의 값을 그대로 사용하므로 스킵한다.
 * 프로덕션에서도 ECS secrets 등으로 이미 주입된 값이 있으면 덮어쓰지 않는다.
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
    const profile = process.env.AWS_PROFILE;

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
 * 환경변수로 시크릿 ID를 전달받는다.
 */
interface SecretMapping {
  /** process.env에서 시크릿 ID를 읽을 키 (예: SECRET_DB_PASSWORD_ID) */
  secretIdEnvKey: string;
  /** 가져온 값을 주입할 process.env 키(들) */
  inject: SecretInjection;
}

type SecretInjection =
  | { type: 'plain'; envKey: string }
  | { type: 'json'; fields: { jsonKey: string; envKey: string }[] };

const SECRET_MAPPINGS: SecretMapping[] = [
  {
    secretIdEnvKey: 'SECRET_DB_PASSWORD_ID',
    inject: {
      type: 'json',
      fields: [{ jsonKey: 'password', envKey: 'DB_PASSWORD' }],
    },
  },
  {
    secretIdEnvKey: 'SECRET_ENCRYPTION_KEY_ID',
    inject: { type: 'plain', envKey: 'ENCRYPTION_KEY' },
  },
];

async function loadAndInjectSecret(mapping: SecretMapping): Promise<void> {
  const secretId = process.env[mapping.secretIdEnvKey];
  if (!secretId) {
    return; // 시크릿 ID가 설정되지 않으면 스킵 (개발 환경 등)
  }

  const raw = await fetchSecret(secretId);

  if (mapping.inject.type === 'plain') {
    // 이미 값이 있고, placeholder가 아니면 덮어쓰지 않음 (ECS secrets 등)
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
  // 캐시 무효화 후 다시 로드
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
        `[SecretsLoader] Failed to refresh secret ${secretId}:`,
        error,
      );
      // 갱신 실패 시 기존 값 유지 (장애 전파 방지)
    }
  }
}

/**
 * 애플리케이션 부트스트랩 전 호출.
 * 프로덕션 환경에서 Secrets Manager로부터 민감정보를 로딩하여 process.env에 주입한다.
 * 로딩 후 TTL 기반 주기적 갱신 타이머를 시작한다.
 */
export async function loadSecrets(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // 개발/테스트 환경에서는 .env 파일 사용 → 스킵
  if (nodeEnv !== 'production') {
    return;
  }

  // 시크릿 ID 환경변수가 하나도 없으면 스킵 (ECS에서 직접 주입하는 경우)
  const hasAnySecretId = SECRET_MAPPINGS.some(
    (m) => !!process.env[m.secretIdEnvKey],
  );
  if (!hasAnySecretId) {
    return;
  }

  console.log('[SecretsLoader] Loading secrets from AWS Secrets Manager...');

  const results = await Promise.allSettled(
    SECRET_MAPPINGS.map((m) => loadAndInjectSecret(m)),
  );

  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  if (failed.length > 0) {
    for (const f of failed) {
      console.error('[SecretsLoader] Secret load failed:', f.reason);
    }
    throw new Error(
      `[SecretsLoader] Failed to load ${failed.length} secret(s). Aborting startup.`,
    );
  }

  console.log(
    `[SecretsLoader] Successfully loaded ${results.length - failed.length} secret(s).`,
  );

  // TTL 기반 주기적 갱신 시작
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshSecrets();
    }, CACHE_TTL_MS);

    // Node.js 프로세스 종료를 방해하지 않도록 unref
    if (
      refreshTimer &&
      typeof refreshTimer === 'object' &&
      'unref' in refreshTimer
    ) {
      refreshTimer.unref();
    }
  }
}

/**
 * 테스트 또는 graceful shutdown 시 타이머 정리.
 */
export function stopSecretsRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  cache.clear();
  smClient = null;
}
