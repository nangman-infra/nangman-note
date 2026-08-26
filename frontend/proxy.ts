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
 * App Router 의 prefetch 요청 여부.
 * prefetch 에 302(로그인 페이지)를 응답하면 router cache 가 오염되어
 * 이후 클릭/뒤로가기가 로그인 페이지로 빠지는 고질적 버그가 생긴다.
 */
function isPrefetchRequest(request: NextRequest): boolean {
  if (request.headers.get('next-router-prefetch') === '1') {
    return true;
  }
  const purpose =
    request.headers.get('purpose') ?? request.headers.get('sec-purpose') ?? '';
  return purpose.toLowerCase().includes('prefetch');
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
      // prefetch 는 리다이렉트 대신 no-store 빈 응답 — cache 오염 방지.
      // 실제 내비게이션 시 아래 redirect 가 정상 동작한다.
      if (isPrefetchRequest(request)) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'cache-control': 'no-store' },
        });
      }
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
      const response = NextResponse.redirect(signInUrl);
      // 리다이렉트가 브라우저/중간 캐시에 저장돼 로그인 후에도
      // 뒤로가기가 로그인 페이지로 튕기는 것을 방지한다.
      response.headers.set('cache-control', 'no-store');
      return response;
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
