import Link from 'next/link';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

type SignInErrorInfo = {
  title: string;
  description: string;
};

export type AuthEntryMode = 'signin' | 'signup';
export type EmailSignInStatus = 'idle' | 'submitting' | 'sent' | 'error';

type SignInCardProps = {
  mode: AuthEntryMode;
  errorInfo: SignInErrorInfo | null;
  email: string;
  emailError: string;
  emailStatus: EmailSignInStatus;
  onEmailChange: (value: string) => void;
  onEmailSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSsoSignIn: () => void;
};

const AUTH_ENTRY_COPY: Record<
  AuthEntryMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    emailButton: string;
    switchLabel: string;
    switchHref: string;
    switchAction: string;
  }
> = {
  signin: {
    eyebrow: 'General login',
    title: '이메일로 로그인',
    description: '비밀번호 없이 이메일로 받은 매직 링크를 눌러 로그인합니다.',
    emailButton: '일반 로그인',
    switchLabel: '처음 사용하시나요?',
    switchHref: '/auth/signup',
    switchAction: '회원가입',
  },
  signup: {
    eyebrow: 'Create account',
    title: '이메일로 시작하기',
    description: '이름과 비밀번호 없이 이메일 주소 하나로 시작합니다.',
    emailButton: '매직 링크 받기',
    switchLabel: '이미 계정이 있나요?',
    switchHref: '/auth/signin',
    switchAction: '로그인',
  },
};

export function SignInCard({
  mode,
  errorInfo,
  email,
  emailError,
  emailStatus,
  onEmailChange,
  onEmailSubmit,
  onSsoSignIn,
}: SignInCardProps) {
  const copy = AUTH_ENTRY_COPY[mode];

  return (
    <aside className="motion-rise lg:col-span-5">
      <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7">
          <p className="label-sm text-[var(--ink-muted)]">{copy.eyebrow}</p>
          <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--ink-strong)]">
            {copy.title}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            {copy.description}
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
              onClick={onSsoSignIn}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </button>
          </div>
        )}

        <form onSubmit={onEmailSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="email"
              className="label-sm mb-1.5 block text-[var(--ink-muted)]"
            >
              이메일
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="name@example.com"
                className="input-shell w-full !pl-10"
                aria-invalid={emailError ? 'true' : 'false'}
                aria-describedby={emailError ? 'email-error' : undefined}
                disabled={emailStatus === 'submitting'}
              />
            </div>
            {emailError ? (
              <p id="email-error" className="mt-1.5 text-xs text-rose-600">
                {emailError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={emailStatus === 'submitting'}
            className="btn-primary inline-flex w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60"
          >
            {emailStatus === 'submitting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {emailStatus === 'submitting' ? '메일 발송 중' : copy.emailButton}
          </button>
        </form>

        {emailStatus === 'sent' ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3" role="status">
            <div className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-xs leading-relaxed text-emerald-800">
                입력한 이메일로 로그인 링크를 보냈습니다. 메일함에서 링크를
                열면 TransNote로 돌아옵니다.
              </p>
            </div>
          </div>
        ) : null}

        {emailStatus === 'error' ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3" role="alert">
            <div className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
              <p className="text-xs leading-relaxed text-rose-800">
                메일 발송을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.
              </p>
            </div>
          </div>
        ) : null}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--line-soft)]" />
          <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
            또는
          </span>
          <div className="h-px flex-1 bg-[var(--line-soft)]" />
        </div>

        <button
          type="button"
          onClick={onSsoSignIn}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface-container-low)] px-4 py-3 text-sm font-bold text-[var(--brand)] transition hover:bg-[var(--surface-container-high)]"
        >
          <Lock className="h-4 w-4" />
          낭만 계정으로 로그인
        </button>

        <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3">
          <div className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
            <div>
              <p className="text-xs font-semibold text-indigo-800">
                비밀번호 없는 로그인
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-indigo-700">
                이름과 비밀번호는 받지 않습니다. 이메일은 로그인 링크 발송과
                계정 식별에만 사용합니다.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--ink-muted)]">
          {copy.switchLabel}{' '}
          <Link
            href={copy.switchHref}
            className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
          >
            {copy.switchAction}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-muted)]">
          로그인 시{' '}
          <Link
            href="/legal/terms"
            className="font-semibold text-indigo-700 hover:underline"
          >
            서비스 이용 약관
          </Link>
          과{' '}
          <Link
            href="/legal/privacy"
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
