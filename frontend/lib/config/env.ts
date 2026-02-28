import { z } from 'zod';

const runtimeModeSchema = z.enum(['development', 'production', 'test']);

const runtimeMode = runtimeModeSchema.parse(process.env.NODE_ENV || 'development');

const commonSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default('TransNote'),
  NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1).default('1.0.0'),
  NEXT_PUBLIC_ENABLE_OFFLINE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_AUTO_SAVE_DELAY: z.coerce.number().int().min(500).max(10000).default(3000),
});

/**
 * API_URL: same-origin 프록시를 사용하므로 기본값은 빈 문자열.
 * Next.js rewrites 가 /api/* → 백엔드, /ws/* → 백엔드 로 프록시합니다.
 * 빈 문자열이면 axios baseURL이 현재 origin을 사용합니다.
 */
const endpointSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().trim().default(''),
  NEXT_PUBLIC_WS_URL: z.string().trim().default(''),
});

const envSchema = endpointSchema.merge(commonSchema);

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_ENABLE_OFFLINE: process.env.NEXT_PUBLIC_ENABLE_OFFLINE,
  NEXT_PUBLIC_AUTO_SAVE_DELAY: process.env.NEXT_PUBLIC_AUTO_SAVE_DELAY,
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
  /** WebSocket base URL. 빈 문자열이면 same-origin (Next.js rewrite 프록시). */
  WS_URL: parsedEnv.data.NEXT_PUBLIC_WS_URL,
  APP_NAME: parsedEnv.data.NEXT_PUBLIC_APP_NAME,
  APP_VERSION: parsedEnv.data.NEXT_PUBLIC_APP_VERSION,
  ENABLE_OFFLINE: parsedEnv.data.NEXT_PUBLIC_ENABLE_OFFLINE,
  AUTO_SAVE_DELAY: parsedEnv.data.NEXT_PUBLIC_AUTO_SAVE_DELAY,
});
