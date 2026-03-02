'use client';

import { signIn } from 'next-auth/react';
import { ShieldCheck, Sparkles, Lock } from 'lucide-react';

export default function SignInPage() {
  const handleSignIn = () => {
    void signIn('authentik', { callbackUrl: '/' });
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

          {/* 로그인 버튼 */}
          <button
            type="button"
            onClick={handleSignIn}
            className="btn-neo w-full border-transparent bg-brand py-3.5 text-base font-semibold text-white hover:bg-brand-strong hover:text-white"
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

        {/* 하단 기능 소개 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <FeatureChip emoji="🎙️" label="실시간 전사" />
          <FeatureChip emoji="📝" label="노트 동기화" />
          <FeatureChip emoji="🤖" label="AI 회의록" />
        </div>

        {/* 푸터 */}
        <p className="mt-6 text-center text-[11px] text-muted">
          © 낭만 인프라 · TransNote v1.0
        </p>
      </div>
    </div>
  );
}

function FeatureChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="glass-surface flex flex-col items-center gap-1 px-2 py-2.5 text-center">
      <span className="text-lg">{emoji}</span>
      <span className="text-[10px] font-medium text-muted">{label}</span>
    </div>
  );
}