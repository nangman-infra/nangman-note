/**
 * 런타임 환경변수 클라이언트 리더.
 *
 * Next.js의 `NEXT_PUBLIC_*` 환경변수는 빌드 타임에 코드에 인라인되므로
 * Docker 이미지를 한 번 빌드하고 여러 환경(dev/staging/prod)에서
 * 재사용할 수 없다.
 *
 * 이 모듈은 서버 컴포넌트(layout.tsx)에서 `<script>` 태그로
 * `window.__RUNTIME_ENV__`에 주입된 런타임 환경변수를 읽는다.
 *
 * @example
 * // layout.tsx (서버 컴포넌트)
 * <script dangerouslySetInnerHTML={{
 *   __html: `window.__RUNTIME_ENV__=${JSON.stringify({ WS_URL: process.env.WS_URL || '' })}`
 * }} />
 *
 * // 클라이언트 코드
 * import { getRuntimeEnv } from '@/lib/config/runtime-env';
 * const wsUrl = getRuntimeEnv('WS_URL');
 */

export interface RuntimeEnv {
  /** WebSocket base URL. 빈 문자열이면 same-origin (NPM 프록시). */
  WS_URL: string;
}

declare global {
  interface Window {
    __RUNTIME_ENV__?: RuntimeEnv;
  }
}

/**
 * 런타임 환경변수 값을 가져온다.
 * SSR 중이거나 값이 없으면 빈 문자열을 반환한다.
 */
export function getRuntimeEnv<K extends keyof RuntimeEnv>(key: K): RuntimeEnv[K] {
  if (typeof window === 'undefined') return '' as RuntimeEnv[K];
  return window.__RUNTIME_ENV__?.[key] ?? ('' as RuntimeEnv[K]);
}