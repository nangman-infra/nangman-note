import Link from 'next/link';
import { AlertTriangle, Lock, RefreshCw, ShieldCheck } from 'lucide-react';

type SignInErrorInfo = {
  title: string;
  description: string;
};

type SignInCardProps = {
  errorInfo: SignInErrorInfo | null;
  onSignIn: () => void;
};

export function SignInCard({ errorInfo, onSignIn }: SignInCardProps) {
  return (
    <aside className="motion-rise lg:col-span-5">
      <div className="rounded-2xl bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-7">
          <p className="label-sm text-[var(--ink-muted)]">Get started</p>
          <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--ink-strong)]">
            시작하기
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            SSO로 간편 로그인하세요.
          </p>
        </div>

        {errorInfo && (
          <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3.5" role="alert">
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
              onClick={onSignIn}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onSignIn}
          className="btn-primary inline-flex w-full py-3.5 text-base"
        >
          <Lock className="h-4 w-4" />
          낭만 계정으로 로그인
        </button>

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
  );
}
