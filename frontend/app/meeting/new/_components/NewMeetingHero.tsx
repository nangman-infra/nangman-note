'use client';

import { ArrowLeft, Clock3, Mic, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

interface NewMeetingHeroProps {
  onBack: () => void;
}

export function NewMeetingHero({ onBack }: NewMeetingHeroProps) {
  return (
    <section className="motion-rise hidden flex-col lg:col-span-7 lg:flex">
      <button
        type="button"
        onClick={onBack}
        className="btn-secondary mb-6 inline-flex w-fit text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        워크스페이스로 돌아가기
      </button>

      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold tracking-wide text-indigo-700">
        <Sparkles className="h-3.5 w-3.5" />
        Start Session
      </span>

      <h1 className="mt-5 font-headline text-4xl font-extrabold tracking-tight text-[var(--ink-strong)] sm:text-5xl">
        회의를 시작하고
        <br />
        <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-container)] bg-clip-text text-transparent">
          노트를 바로 작성하세요
        </span>
      </h1>

      <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--ink-muted)]">
        제목만 입력하면 바로 시작됩니다. 전사 모드, 언어, 번역은 기본 설정이
        자동 적용됩니다.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <FeatureCard
          icon={Clock3}
          title="실시간 기록"
          description="노트 자동 저장 + 전사 수집"
        />
        <FeatureCard
          icon={ShieldCheck}
          title="보안 우선"
          description="녹음 파일 미저장 정책"
        />
        <FeatureCard
          icon={Mic}
          title="빠른 시작"
          description="제목만 입력하면 바로 시작"
        />
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl bg-[var(--surface-container-low)] p-4 transition hover:bg-[var(--surface-container-high)]">
      <div className="mb-2 inline-flex rounded-full bg-indigo-100 p-2 text-indigo-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--ink-strong)]">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{description}</p>
    </article>
  );
}
