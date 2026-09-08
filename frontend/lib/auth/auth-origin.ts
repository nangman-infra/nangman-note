import { env, getServerRuntimeVar } from '@/lib/config/env';

type RuntimeMode = 'development' | 'production' | 'test';

type RequestOriginSource = {
  url: string;
  headers: Pick<Headers, 'get'>;
};

function firstHeaderValue(value: string | null): string {
  return value?.split(',')[0]?.trim() ?? '';
}

/**
 * OAuth 시작 URL, callback URL, state/PKCE 쿠키가 모두 공유할 공개 origin을 검증한다.
 * path/query/hash가 붙거나 CORS_ORIGIN처럼 여러 URL이 들어오면 다른 host에 쿠키가
 * 생성될 수 있으므로 허용하지 않는다.
 */
export function parseAuthPublicUrl(
  rawValue: string,
  mode: RuntimeMode = env.MODE,
): URL {
  const value = rawValue.trim();
  if (!value) {
    throw new Error('Missing required server runtime env: NEXTAUTH_URL');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      'NEXTAUTH_URL must be one absolute public origin (for example, https://app.example.com).',
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('NEXTAUTH_URL must use http or https.');
  }
  if (url.username || url.password) {
    throw new Error('NEXTAUTH_URL must not contain credentials.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('NEXTAUTH_URL must contain only an origin, without a path, query, or hash.');
  }
  if (mode === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXTAUTH_URL must use https in production.');
  }

  return url;
}

export function getAuthPublicUrl(): URL {
  return parseAuthPublicUrl(getServerRuntimeVar('NEXTAUTH_URL'));
}

/**
 * NPM/TLS 종료 프록시가 전달한 최초 host/proto를 우선한다.
 * NextAuth 4.24도 AUTH_TRUST_HOST=true일 때 같은 두 헤더로 origin을 계산한다.
 */
export function getExternalRequestOrigin(request: RequestOriginSource): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(
    request.headers.get('x-forwarded-host'),
  );
  const host =
    forwardedHost || firstHeaderValue(request.headers.get('host')) || requestUrl.host;
  const forwardedProto = firstHeaderValue(
    request.headers.get('x-forwarded-proto'),
  ).toLowerCase();
  const protocol = ['http', 'https'].includes(forwardedProto)
    ? forwardedProto
    : requestUrl.protocol.slice(0, -1);

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}
