import Link from 'next/link';
import {
  AlertTriangle,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

type SignInErrorInfo = {
  title: string;
  description: string;
};

export type AuthEntryMode = 'signin' | 'signup';

type SignInCardProps = {
  mode: AuthEntryMode;
  errorInfo: SignInErrorInfo | null;
  onSsoSignIn: () => void;
};

const AUTH_ENTRY_COPY: Record<
  AuthEntryMode,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  signin: {
    eyebrow: 'Organization login',
    title: '낭만 계정으로 로그인',
    description: '낭만 인프라 Authentik 계정으로 안전하게 로그인합니다.',
  },
  signup: {
    eyebrow: 'Organization login',
    title: '낭만 계정으로 시작하기',
    description: '낭만 인프라 Authentik 계정으로 안전하게 로그인합니다.',
  },
};

export function SignInCard({
  mode,
  errorInfo,
  onSsoSignIn,
}: SignInCardProps) {
  const copy = AUTH_ENTRY_COPY[mode];

  return (
    <aside className="motion-rise lg:col-span-5">
      <div className="surface-card !rounded-[24px] p-6 sm:p-8">
        <div className="mb-7">
          <p className="label-sm">{copy.eyebrow}</p>
          <h2 className="font-headline mt-1.5 text-2xl text-[var(--ink-strong)]">
            {copy.title}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            {copy.description}
          </p>
        </div>

        {errorInfo && (
          <div
            className="mb-5 rounded-lg border border-[var(--line-soft)] bg-[var(--danger-soft)] px-4 py-3.5 shadow-[inset_3px_0_0_0_var(--danger)]"
            role="alert"
          >
            <div className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--danger)]" />
              <div>
                <p className="text-xs font-medium text-[var(--ink-strong)]">
                  {errorInfo.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-subtle)]">
                  {errorInfo.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSsoSignIn}
              className="btn-neo mt-3 inline-flex w-full !py-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onSsoSignIn}
          className="btn-primary inline-flex w-full !py-3"
        >
          <Lock className="h-4 w-4" />
          낭만 계정으로 로그인
        </button>

        <div className="surface-tonal mt-4 px-4 py-3">
          <div className="flex gap-2.5">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-electric"
              strokeWidth={1.5}
            />
            <div>
              <p className="text-xs font-medium text-[var(--ink-strong)]">
                조직 계정으로 안전하게
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                계정과 접근 권한은 낭만 인프라의 Authentik에서 관리합니다.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-muted)]">
          로그인 시{' '}
          <Link
            href="/legal/terms"
            className="link-electric text-[var(--ink-subtle)]"
          >
            서비스 이용 약관
          </Link>
          과{' '}
          <Link
            href="/legal/privacy"
            className="link-electric text-[var(--ink-subtle)]"
          >
            개인정보 처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
      </div>

      <p className="mt-5 text-center text-xs text-[var(--ink-muted)]">
        © 낭만 인프라 · TransNote v1.0
      </p>
    </aside>
  );
}
