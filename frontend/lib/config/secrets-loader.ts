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

interface SecretField {
  jsonKey: string;
  envKey: string;
  /**
   * 프로세스 수명 동안 고정되어야 하는 값.
   * NEXTAUTH_SECRET 은 세션 쿠키(JWE) 암호화 키이므로 런타임에 바꾸면
   * 로그인된 모든 사용자의 세션이 즉시 무효화된다. 회전은 재배포(재시작)로만 반영한다.
   */
  stable?: boolean;
}

type SecretInjection =
  | { type: 'plain'; envKey: string; stable?: boolean }
  | { type: 'json'; fields: SecretField[] };

const SECRET_MAPPINGS: SecretMapping[] = [
  {
    secretIdEnvKey: 'SECRET_AUTH_ID',
    inject: {
      type: 'json',
      fields: [
        { jsonKey: 'NEXTAUTH_SECRET', envKey: 'NEXTAUTH_SECRET', stable: true },
        {
          jsonKey: 'AUTHENTIK_CLIENT_SECRET',
          envKey: 'AUTHENTIK_CLIENT_SECRET',
        },
      ],
    },
  },
];

function parseJsonSecret(raw: string, secretId: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('secret value is not a JSON object');
    }
    return parsed as Record<string, string>;
  } catch (error) {
    throw new Error(
      `[SecretsLoader:FE] Secret ${secretId} must be a JSON object: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function assertRequiredFields(
  parsed: Record<string, string>,
  fields: SecretField[],
  secretId: string,
): void {
  const missing = fields
    .filter((field) => !process.env[field.envKey])
    .filter((field) => {
      const value = parsed[field.jsonKey];
      return typeof value !== 'string' || value.trim().length === 0;
    })
    .map((field) => field.jsonKey);

  if (missing.length > 0) {
    // 빈 값을 주입하면 NextAuth 핸들러가 요청마다 500 을 내고 클라이언트는
    // 조용히 세션 null 을 받는다. 부팅 시점에 명확히 실패시키는 것이 낫다.
    throw new Error(
      `[SecretsLoader:FE] Secret ${secretId} is missing required key(s): ${missing.join(', ')}`,
    );
  }
}

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
    const parsed = parseJsonSecret(raw, secretId);
    assertRequiredFields(parsed, mapping.inject.fields, secretId);
    for (const field of mapping.inject.fields) {
      if (!process.env[field.envKey]) {
        process.env[field.envKey] = parsed[field.jsonKey];
      }
    }
  }
}

function applyRefreshedValue(
  envKey: string,
  nextValue: string | undefined,
  stable: boolean | undefined,
  secretId: string,
): void {
  if (typeof nextValue !== 'string' || nextValue.trim().length === 0) {
    // 회전 중 일시적으로 비어 있을 수 있음 — 기존 값을 유지한다.
    return;
  }

  const currentValue = process.env[envKey];
  if (currentValue === nextValue) {
    return;
  }

  if (stable) {
    console.warn(
      `[SecretsLoader:FE] ${envKey} in secret ${secretId} changed; ` +
        'keeping the boot-time value. Restart the service to apply the rotated secret.',
    );
    return;
  }

  process.env[envKey] = nextValue;
}

async function refreshSecrets(): Promise<void> {
  cache.clear();

  for (const mapping of SECRET_MAPPINGS) {
    const secretId = process.env[mapping.secretIdEnvKey];
    if (!secretId) continue;

    try {
      const raw = await fetchSecret(secretId);

      if (mapping.inject.type === 'plain') {
        applyRefreshedValue(
          mapping.inject.envKey,
          raw,
          mapping.inject.stable,
          secretId,
        );
      } else {
        const parsed = parseJsonSecret(raw, secretId);
        for (const field of mapping.inject.fields) {
          applyRefreshedValue(
            field.envKey,
            parsed[field.jsonKey],
            field.stable,
            secretId,
          );
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
