'use client';

import type { ReactNode } from 'react';
import { ScrollReveal } from './ScrollReveal';

interface FeatureSectionProps {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
  reverse?: boolean;
}

export function FeatureSection({
  badge,
  title,
  description,
  children,
  reverse = false,
}: FeatureSectionProps) {
  return (
    <div className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12 ${reverse ? 'lg:flex-row-reverse' : ''}`}>
      <div className="min-w-0 flex-1">
        <ScrollReveal>
          <span className="inline-block rounded-full border border-[var(--line-soft)] bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand">
            {badge}
          </span>
          <h3 className="mt-3 text-xl font-bold sm:text-2xl">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        </ScrollReveal>
      </div>
      <div className="min-w-0 flex-1">
        <ScrollReveal delay={120}>{children}</ScrollReveal>
      </div>
    </div>
  );
}
