'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Check,
  ArrowRight,
} from 'lucide-react';

function getErrorInfo(errorCode: string | null): { title: string; description: string } | null {
  if (!errorCode) return null;

  switch (errorCode) {
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
    case 'Callback':
      return {
        title: '인증 처리 중 오류가 발생했습니다',
        description: '서버와의 통신 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      };
    case 'AccessDenied':
      return {
        title: '접근이 거부되었습니다',
        description: '이 서비스에 대한 접근 권한이 없습니다. 낭만 인프라 소속 계정인지 확인해주세요.',
      };
    case 'Configuration':
    case 'OAuthAccountNotLinked':
      return {
        title: '서버 설정 오류가 발생했습니다',
        description: '인증 서버 설정에 문제가 있습니다. 관리자에게 문의해주세요.',
      };
    default:
      return {
        title: '로그인에 실패했습니다',
        description: '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.',
      };
  }
}

const FEATURE_BULLETS: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: '실시간 전사',
    description: '화자 구분과 타임스탬프가 포함된 라이브 스크립트',
  },
  {
    title: 'AI 회의록 생성',
    description: '요약, 액션 아이템, 핵심 주제를 자동으로 구조화',
  },
  {
    title: '클립 · 문서 내보내기',
    description: 'Markdown · PDF로 정제된 문서로 바로 공유',
  },
];

function SignInContent() {
  const searchParams = useSearchParams();
  const errorInfo = getErrorInfo(searchParams.get('error'));

  const handleSignIn = () => {
    const callbackUrl = normalizeCallbackUrl(searchParams.get('callbackUrl'));
    void signIn('authentik', { callbackUrl });
  };

  return (
    <div className="relative min-h-dvh bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Ambient brand glow — subtle indigo wash, no lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Left column — marketing copy */}
          <section className="motion-rise lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold tracking-wide text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Cognitive Workspace
            </span>

            <h1 className="mt-5 font-headline text-4xl font-extrabold tracking-tight text-[var(--ink-strong)] sm:text-5xl lg:text-6xl">
              AI가 함께하는
              <br />
              <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-container)] bg-clip-text text-transparent">
                회의 노트
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--ink-muted)]">
              실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스.
              말하는 동안 정리되고, 끝나면 회의록이 완성됩니다.
            </p>

            <ul className="mt-8 space-y-3.5">
              {FEATURE_BULLETS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">
                      {item.title}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Secondary discovery links — no borders, tonal hover */}
            <div className="mt-10 flex flex-wrap items-center gap-5 text-xs text-[var(--ink-muted)]">
              <Link
                href="/landing"
                className="inline-flex items-center gap-1 font-semibold text-indigo-700 transition hover:text-indigo-900"
              >
                서비스 소개
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/landing/guide"
                className="inline-flex items-center gap-1 font-semibold text-indigo-700 transition hover:text-indigo-900"
              >
                7단계 사용 가이드
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* Right column — SSO card */}
          <aside className="motion-rise lg:col-span-5">
            <div className="rounded-2xl bg-white p-8 shadow-xl sm:p-10">
              {/* Card header */}
              <div className="mb-7">
                <p className="label-sm text-[var(--ink-muted)]">Get started</p>
                <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--ink-strong)]">
                  시작하기
                </h2>
                <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
                  SSO로 간편 로그인하세요.
                </p>
              </div>

              {/* Error feedback */}
              {errorInfo && (
                <div
                  className="mb-5 rounded-xl bg-rose-50 px-4 py-3.5"
                  role="alert"
                >
                  <div className="flex gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                    <div>
                      <p className="text-xs font-semibold text-rose-800">
                        {errorInfo.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
                        {errorInfo.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    다시 시도
                  </button>
                </div>
              )}

              {/* Primary SSO button — Authentik */}
              <button
                type="button"
                onClick={handleSignIn}
                className="btn-primary inline-flex w-full py-3.5 text-base"
              >
                <Lock className="h-4 w-4" />
                낭만 계정으로 로그인
              </button>

              {/* Access notice — tonal amber, No-Line */}
              <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3">
                <div className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      낭만 인프라 전용 서비스
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                      이 애플리케이션은 낭만 인프라 소속 구성원만 사용할 수 있으며,
                      Authentik SSO 계정이 필요합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fine print */}
              <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-muted)]">
                로그인 시{' '}
                <Link
                  href="/landing"
                  className="font-semibold text-indigo-700 hover:underline"
                >
                  서비스 이용 약관
                </Link>
                과{' '}
                <Link
                  href="/landing"
                  className="font-semibold text-indigo-700 hover:underline"
                >
                  개인정보 처리방침
                </Link>
                에 동의하게 됩니다.
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] text-[var(--ink-muted)]">
              © 낭만 인프라 · TransNote v1.0
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-muted)]" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent />
    </Suspense>
  );
}

function normalizeCallbackUrl(rawValue: string | null): string {
  if (!rawValue) {
    return '/';
  }

  if (rawValue.startsWith('/')) {
    return rawValue;
  }

  try {
    const url = new URL(rawValue);
    if (typeof window !== 'undefined' && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // noop: fallback to root
  }

  return '/';
}
