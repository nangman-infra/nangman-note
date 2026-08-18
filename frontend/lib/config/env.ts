import { z } from 'zod';

const runtimeModeSchema = z.enum(['development', 'production', 'test']);

const runtimeMode = runtimeModeSchema.parse(process.env.NODE_ENV || 'development');

const commonSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default('TransNote'),
  NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1).default('1.0.0'),
  NEXT_PUBLIC_AUTO_SAVE_DELAY: z.coerce.number().int().min(500).max(10000).default(3000),
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: z.string().trim().default(''),
  NEXT_PUBLIC_ANALYTICS_SITE_ID: z.string().trim().default(''),
});

/**
 * API_URL: same-origin 프록시를 사용하므로 기본값은 빈 문자열.
 * Next.js rewrites 가 /api/* → 백엔드로 프록시합니다.
 * 빈 문자열이면 axios baseURL이 현재 origin을 사용합니다.
 *
 * WS_URL은 런타임 환경변수로 전환됨 → runtime-env.ts 참고.
 */
const endpointSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().trim().default(''),
});

const envSchema = endpointSchema.merge(commonSchema);

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_AUTO_SAVE_DELAY: process.env.NEXT_PUBLIC_AUTO_SAVE_DELAY,
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL:
    process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL,
  NEXT_PUBLIC_ANALYTICS_SITE_ID: process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid frontend environment variables:\n${issues}`);
}

export const env = Object.freeze({
  MODE: runtimeMode,
  /** API base URL. 빈 문자열이면 same-origin (Next.js rewrite 프록시). */
  API_URL: parsedEnv.data.NEXT_PUBLIC_API_URL,
  APP_NAME: parsedEnv.data.NEXT_PUBLIC_APP_NAME,
  APP_VERSION: parsedEnv.data.NEXT_PUBLIC_APP_VERSION,
  AUTO_SAVE_DELAY: parsedEnv.data.NEXT_PUBLIC_AUTO_SAVE_DELAY,
  /** opt-in 웹 분석 스크립트 (빈 문자열이면 비활성) */
  ANALYTICS_SCRIPT_URL: parsedEnv.data.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL,
  ANALYTICS_SITE_ID: parsedEnv.data.NEXT_PUBLIC_ANALYTICS_SITE_ID,
});

/**
 * 서버 컴포넌트에서 런타임 환경변수를 읽기 위한 헬퍼.
 * (클라이언트 번들 고정값이 아닌 서버 프로세스 런타임 값을 사용)
 */
type ServerRuntimeKey =
  | 'WS_URL'
  | 'NEXTAUTH_URL'
  | 'NEXTAUTH_SECRET'
  | 'AUTHENTIK_ISSUER'
  | 'AUTHENTIK_CLIENT_ID'
  | 'AUTHENTIK_CLIENT_SECRET';

export function getServerRuntimeVar(key: ServerRuntimeKey): string {
  return process.env[key] || '';
}

export function getServerRequiredVar(key: ServerRuntimeKey): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required server runtime env: ${key}`);
  }
  return value;
}
