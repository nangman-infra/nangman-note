import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  isBackendProxyPath,
  isHealthPath,
  isNextAuthPath,
  isProtectedPath,
} from '@/lib/auth/route-policy';

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
 * 백엔드 에러 응답과 같은 형태의 401 JSON.
 * apiClient 의 응답 인터셉터가 동일한 파서로 처리할 수 있다.
 */
function unauthorizedApiResponse(pathname: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'Unauthenticated',
        statusCode: 401,
        message: 'Authentication required',
        path: pathname,
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 401,
      headers: {
        'cache-control': 'no-store',
        'www-authenticate': 'Bearer realm="api"',
      },
    },
  );
}

function redirectToSignIn(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
  const response = NextResponse.redirect(signInUrl);
  // 리다이렉트가 브라우저/중간 캐시에 저장돼 로그인 후에도
  // 뒤로가기가 로그인 페이지로 튕기는 것을 방지한다.
  response.headers.set('cache-control', 'no-store');
  return response;
}

/**
 * Next.js Proxy
 *
 * 1. 보호 페이지(/, /meeting/*, /settings/*): NextAuth 세션 쿠키가 없으면 로그인 페이지로.
 * 2. /api/*, /ws/* (NextAuth·헬스체크 제외): 세션 쿠키에 access token 이 없으면 401 JSON 으로
 *    즉시 응답한다. 익명·만료 세션의 요청이 백엔드까지 가서 401 로그 노이즈를 만들지 않는다.
 *    실제 토큰 검증(서명·issuer·audience)은 백엔드가 한다 — 여기서는 "토큰을 들고 있는가"만 본다.
 * 3. 통과한 요청은 런타임 BACKEND_URL 로 rewrite (요청 헤더는 Authorization 포함 그대로 전달됨).
 *
 * next.config.ts 의 rewrites() 는 빌드 타임에 직렬화되어 런타임 환경 변수를 사용할 수 없으므로
 * proxy 에서 서버사이드 프록시를 구현한다.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;

  if (isProtectedPath(pathname)) {
    const token = await getToken({ req: request, secret });

    if (!token) {
      // prefetch 는 리다이렉트 대신 no-store 빈 응답 — cache 오염 방지.
      // 실제 내비게이션 시 redirect 가 정상 동작한다.
      if (isPrefetchRequest(request)) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'cache-control': 'no-store' },
        });
      }
      return redirectToSignIn(request);
    }
    // 세션은 있지만 access token 이 없는(refresh 실패) 경우는 페이지를 열어 준다.
    // AuthSessionProvider 가 SSO 재로그인을 1회 시도한다. 여기서 로그인 페이지로 보내면
    // 로그인 페이지 ↔ 홈 사이 리다이렉트 루프가 생길 수 있다.
    return NextResponse.next();
  }

  if (
    !isBackendProxyPath(pathname) ||
    isNextAuthPath(pathname) ||
    isHealthPath(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret });
  if (!token || typeof token.accessToken !== 'string' || token.error) {
    return unauthorizedApiResponse(pathname);
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:9999';
  const destination = new URL(`${pathname}${search}`, backendUrl);

  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: [
    '/',
    '/meeting/:path*',
    '/settings/:path*',
    '/api/:path*',
    '/ws/:path*',
  ],
};
