'use client';

import { ArrowLeft, Clock3, Mic, ShieldCheck, type LucideIcon } from 'lucide-react';

interface NewMeetingHeroProps {
  onBack: () => void;
}

export function NewMeetingHero({ onBack }: NewMeetingHeroProps) {
  return (
    <section className="motion-rise hidden flex-col lg:col-span-7 lg:flex">
      <button
        type="button"
        onClick={onBack}
        className="btn-neo mb-6 inline-flex w-fit !px-3 !py-1.5 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        워크스페이스로 돌아가기
      </button>

      <h1 className="font-display text-[44px] text-[var(--ink-strong)] sm:text-[48px]">
        회의를 시작하고
        <br />
        <span className="text-electric-gradient">노트를 바로 작성하세요</span>
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
    <article className="surface-card p-4">
      <div className="mb-3 inline-flex rounded-[10px] bg-[var(--surface-container)] p-2 text-electric shadow-[var(--elevation-sm)]">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-medium text-[var(--ink-strong)]">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{description}</p>
    </article>
  );
}
