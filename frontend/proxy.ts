import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_PREFIXES = ['/meeting', '/settings'];

function isProtectedPath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isBackendProxyPath(pathname: string): boolean {
  return (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/ws' ||
    pathname.startsWith('/ws/')
  );
}

function isNextAuthPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function isHealthPath(pathname: string): boolean {
  return pathname === '/api/health';
}

/**
 * Next.js Proxy — /api/*, /ws/* 요청을 런타임 BACKEND_URL로 프록시합니다.
 *
 * next.config.ts의 rewrites()는 빌드 타임에 직렬화되어 런타임 환경 변수를 사용할 수 없으므로,
 * proxy에서 서버사이드 프록시를 구현합니다.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const signInUrl = new URL('/api/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }
  }

  if (!isBackendProxyPath(pathname) || isNextAuthPath(pathname) || isHealthPath(pathname)) {
    return NextResponse.next();
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:9999';
  const destination = new URL(`${pathname}${search}`, backendUrl);

  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: ['/', '/meeting/:path*', '/settings/:path*', '/api/:path*', '/ws/:path*'],
};
