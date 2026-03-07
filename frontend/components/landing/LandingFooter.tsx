import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--line-soft)] bg-[var(--bg-root)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] bg-white/80 px-2.5 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              TransNote
            </span>
            <div>
              <p className="text-sm font-semibold">TransNote</p>
              <p className="text-xs text-muted">노트 중심 AI 회의록 워크스페이스</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted">
            <Link href="/landing/features" className="transition hover:text-foreground">
              사용 가이드
            </Link>
            <Link href="/landing/how-it-works" className="transition hover:text-foreground">
              동작 방식
            </Link>
            <Link href="/landing/use-cases" className="transition hover:text-foreground">
              사례
            </Link>
            <Link href="/landing/start" className="transition hover:text-foreground">
              시작하기
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-[11px] text-muted">
          © 낭만 인프라 · TransNote v1.0
        </div>
      </div>
    </footer>
  );
}
