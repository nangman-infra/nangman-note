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
      <span className="tag-dot">
        <Sparkles className="h-3.5 w-3.5 text-electric" strokeWidth={1.5} />
        Meeting notes, engineered
      </span>

      <h1 className="font-display mt-6 text-[44px] text-[var(--ink-strong)] sm:text-[48px] lg:text-[54px]">
        AI가 함께하는
        <br />
        <span className="text-electric-gradient">회의 노트</span>
      </h1>

      <p className="mt-6 max-w-md text-base font-light leading-relaxed text-[var(--ink-subtle)]">
        실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스.
        말하는 동안 정리되고, 끝나면 회의록이 완성됩니다.
      </p>

      <ul className="mt-8 space-y-3.5">
        {FEATURE_BULLETS.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tertiary-fixed)] text-electric">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--ink-strong)]">
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
          className="link-electric inline-flex items-center gap-1 text-[var(--ink-subtle)]"
        >
          서비스 소개
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/landing/guide"
          className="link-electric inline-flex items-center gap-1 text-[var(--ink-subtle)]"
        >
          7단계 사용 가이드
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
