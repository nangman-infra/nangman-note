/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 서버 시작 시 1회 호출된다.
 * AWS Secrets Manager에서 민감정보를 로딩하여 process.env에 주입한다.
 * auth.ts, proxy.ts 등이 process.env를 읽기 전에 실행되어야 한다.
 */
export async function register() {
  // 서버(Node.js) 런타임에서만 실행 — Edge 런타임 제외
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadSecrets } = await import('@/lib/config/secrets-loader');
    await loadSecrets();
  }
}
