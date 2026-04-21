'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SignInCard } from './_components/SignInCard';
import { SignInHero } from './_components/SignInHero';

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
          <SignInHero />
          <SignInCard errorInfo={errorInfo} onSignIn={handleSignIn} />
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
