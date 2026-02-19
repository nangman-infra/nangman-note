import { z } from 'zod';

const runtimeModeSchema = z.enum(['development', 'production', 'test']);

const runtimeMode = runtimeModeSchema.parse(process.env.NODE_ENV || 'development');

const httpUrlSchema = z.string().trim().min(1).refine(
  (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'must be a valid http/https URL' },
);

const wsUrlSchema = z.string().trim().min(1).refine(
  (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
    } catch {
      return false;
    }
  },
  { message: 'must be a valid ws/wss URL' },
);

const commonSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default('TransNote'),
  NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1).default('1.0.0'),
  NEXT_PUBLIC_ENABLE_OFFLINE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_AUTO_SAVE_DELAY: z.coerce.number().int().min(500).max(10000).default(3000),
});

const endpointSchema =
  runtimeMode === 'production'
    ? z.object({
        NEXT_PUBLIC_API_URL: httpUrlSchema.default('https://api.example.com'),
        NEXT_PUBLIC_WS_URL: wsUrlSchema.default('wss://api.example.com'),
      })
    : z.object({
        NEXT_PUBLIC_API_URL: httpUrlSchema.default('http://localhost:9999'),
        NEXT_PUBLIC_WS_URL: wsUrlSchema.default('ws://localhost:9999'),
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

if (runtimeMode === 'production') {
  if (!process.env.NEXT_PUBLIC_API_URL || !process.env.NEXT_PUBLIC_WS_URL) {
    console.warn(
      '[env] Production mode is using fallback endpoints. Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL explicitly.',
    );
  }
}

export const env = Object.freeze({
  MODE: runtimeMode,
  API_URL: parsedEnv.data.NEXT_PUBLIC_API_URL,
  WS_URL: parsedEnv.data.NEXT_PUBLIC_WS_URL,
  APP_NAME: parsedEnv.data.NEXT_PUBLIC_APP_NAME,
  APP_VERSION: parsedEnv.data.NEXT_PUBLIC_APP_VERSION,
  ENABLE_OFFLINE: parsedEnv.data.NEXT_PUBLIC_ENABLE_OFFLINE,
  AUTO_SAVE_DELAY: parsedEnv.data.NEXT_PUBLIC_AUTO_SAVE_DELAY,
});
