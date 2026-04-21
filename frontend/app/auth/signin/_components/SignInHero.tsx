import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

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

export function SignInHero() {
  return (
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
  );
}
