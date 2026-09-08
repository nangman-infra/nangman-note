/**
 * 라우트 분류 규칙 — proxy.ts(서버)와 AuthSessionProvider(클라이언트)가 공유한다.
 * 두 곳의 판단이 어긋나면 리다이렉트 루프가 생기므로 반드시 한 곳에서만 정의한다.
 */

const PROTECTED_PREFIXES = ['/meeting', '/settings'] as const;

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 로그인이 필요한 페이지 */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }
  return PROTECTED_PREFIXES.some((prefix) => hasPrefix(pathname, prefix));
}

/** 로그인/에러 등 인증 UI 페이지 — 여기서는 자동 재인증 리다이렉트를 하지 않는다 */
export function isAuthPath(pathname: string): boolean {
  return hasPrefix(pathname, '/auth');
}

/** 백엔드로 프록시되는 경로 (/api/*, /ws/*) */
export function isBackendProxyPath(pathname: string): boolean {
  return hasPrefix(pathname, '/api') || hasPrefix(pathname, '/ws');
}

/** NextAuth 자체 엔드포인트 — 프록시/인증 게이트 대상이 아님 */
export function isNextAuthPath(pathname: string): boolean {
  return hasPrefix(pathname, '/api/auth');
}

/** 프론트 자체 헬스체크 */
export function isHealthPath(pathname: string): boolean {
  return pathname === '/api/health';
}

/**
 * 로그인 후 복귀할 callbackUrl 을 만든다.
 * 인증 페이지 자체를 callbackUrl 로 만들면 로그인 후 다시 로그인 페이지로 가므로 '/' 로 대체한다.
 */
export function buildCallbackUrl(pathname: string, search = '', hash = ''): string {
  if (!pathname || isAuthPath(pathname)) {
    return '/';
  }
  return `${pathname}${search}${hash}`;
}
