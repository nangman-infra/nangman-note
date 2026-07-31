import { AppEnv } from './env.validation';

export function parseAllowedOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(params: {
  origin: string | undefined;
  allowedOrigins: string[];
  nodeEnv: AppEnv['NODE_ENV'];
  allowWithoutOrigin?: boolean;
}): boolean {
  const { origin, allowedOrigins, nodeEnv, allowWithoutOrigin = true } = params;

  if (!origin) {
    return allowWithoutOrigin;
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return true;
  }

  if (nodeEnv !== 'production') {
    try {
      const parsed = new URL(origin);
      if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}
