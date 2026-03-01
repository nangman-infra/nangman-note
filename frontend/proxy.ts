import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Proxy — /api/*, /ws/* 요청을 런타임 BACKEND_URL로 프록시합니다.
 *
 * next.config.ts의 rewrites()는 빌드 타임에 직렬화되어 런타임 환경 변수를 사용할 수 없으므로,
 * proxy에서 서버사이드 프록시를 구현합니다.
 */
export function proxy(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:9999';
  const { pathname, search } = request.nextUrl;

  const destination = new URL(`${pathname}${search}`, backendUrl);

  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: ['/api/:path*', '/ws/:path*'],
};
