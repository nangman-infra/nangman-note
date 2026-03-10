'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Sparkles, Lock, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

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

function SignInContent() {
  const searchParams = useSearchParams();
  const errorInfo = getErrorInfo(searchParams.get('error'));

  const handleSignIn = () => {
    const callbackUrl = normalizeCallbackUrl(searchParams.get('callbackUrl'));
    void signIn('authentik', { callbackUrl });
  };

  return (
    <div className="app-shell flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 메인 로그인 카드 */}
        <div className="glass-surface motion-rise p-8 sm:p-10">
          {/* 로고 + 브랜드 */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              TransNote
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              AI 회의 기록 워크스페이스
            </h1>
            <p className="mt-2 text-sm text-muted">
              실시간 전사와 노트 중심 워크플로우를 결합한
              <br />
              회의 기록 워크스페이스에 로그인하세요.
            </p>
          </div>

          {/* SSO 에러 피드백 */}
          {errorInfo && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3" role="alert">
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
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </button>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="button"
            onClick={handleSignIn}
            className="btn-neo inline-flex w-full border-transparent bg-brand py-3.5 text-base font-semibold text-white hover:bg-brand-strong hover:text-white"
          >
            <Lock className="h-4 w-4" />
            낭만 계정으로 로그인
          </button>

          {/* 안내 문구 */}
          <div className="mt-6 rounded-xl border border-[var(--line-soft)] bg-amber-50/50 px-4 py-3">
            <div className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  낭만 인프라 전용 서비스
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  이 애플리케이션은 낭만 인프라 소속 구성원만 사용할 수 있습니다.
                  Authentik SSO 계정이 필요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 랜딩 링크 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/landing" className="glass-surface flex items-center gap-2.5 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)]">
            <span className="text-lg">🎙️</span>
            <div>
              <p className="text-xs font-semibold">서비스 소개</p>
              <p className="text-[10px] text-muted">TransNote가 뭔가요?</p>
            </div>
          </Link>
          <Link href="/landing/guide" className="glass-surface flex items-center gap-2.5 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)]">
            <span className="text-lg">📖</span>
            <div>
              <p className="text-xs font-semibold">사용 가이드</p>
              <p className="text-[10px] text-muted">7단계로 배우기</p>
            </div>
          </Link>
        </div>

        {/* 푸터 */}
        <p className="mt-6 text-center text-[11px] text-muted">
          © 낭만 인프라 · TransNote v1.0
        </p>
      </div>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="app-shell flex min-h-dvh items-center justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin text-muted" />
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
