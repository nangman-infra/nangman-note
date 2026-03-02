import { getServerRuntimeVar } from '@/lib/config/env';

const FALLBACK_SITE_URL = 'http://localhost:3000';

/**
 * SEO/metadata에서 사용할 사이트 기준 URL.
 * NEXTAUTH_URL을 우선 사용하고, 없거나 유효하지 않으면 localhost로 fallback 한다.
 */
export function getSiteUrl(): URL {
  const raw = getServerRuntimeVar('NEXTAUTH_URL').trim();

  if (!raw) {
    return new URL(FALLBACK_SITE_URL);
  }

  try {
    return new URL(raw);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}
