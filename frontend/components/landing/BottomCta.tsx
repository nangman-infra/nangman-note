'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

interface BottomCtaProps {
  /** 다음 페이지 안내 링크 (선택) */
  nextHref?: string;
  nextLabel?: string;
}

export function BottomCta({ nextHref, nextLabel }: BottomCtaProps) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-5 text-center">
        <ScrollReveal>
          <h2 className="text-2xl font-bold sm:text-3xl">
            다음 회의부터 바로 써보세요
          </h2>
          <p className="mt-3 text-sm text-muted">
            마이크를 켜고 노트를 적으세요. 회의가 끝나면 정리된 문서가 기다리고 있습니다.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/landing/start"
              className="btn-neo border-transparent bg-brand px-6 py-3 text-sm text-white hover:bg-brand-strong hover:text-white"
            >
              무료로 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            {nextHref && nextLabel && (
              <Link href={nextHref} className="btn-neo px-6 py-3 text-sm">
                {nextLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
