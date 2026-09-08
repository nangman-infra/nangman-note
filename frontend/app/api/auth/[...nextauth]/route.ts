import NextAuth from 'next-auth';
import { getAuthOptions } from '@/auth';

/**
 * NextAuth 옵션은 요청마다 재생성하지 않고 재사용한다(getAuthOptions).
 * 필수 env(AUTHENTIK_*)가 비어 있으면 getAuthOptions()가 throw → 500.
 * 이 경우 클라이언트 getSession()은 null 을 받으므로, 서버 로그에서 원인을 바로 볼 수 있게 남긴다.
 */
function handle(request: Request, context: unknown) {
  try {
    return NextAuth(getAuthOptions())(request, context);
  } catch (error) {
    console.error('[auth] NextAuth handler failed to initialize:', error);
    throw error;
  }
}

export async function GET(request: Request, context: unknown) {
  return handle(request, context);
}

export async function POST(request: Request, context: unknown) {
  return handle(request, context);
}
