'use client';

import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { FaqAccordion } from '@/components/landing/FaqAccordion';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

export function StartContent() {
  return (
    <div className="landing-shell min-h-dvh">
      <LandingNav />
      <main className="pt-28">
        {/* CTA 히어로 */}
        <section className="pb-8">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <ScrollReveal>
              <h1 className="text-3xl font-bold sm:text-4xl">
                다음 회의부터 써보세요
              </h1>
              <p className="mt-3 text-sm text-muted sm:text-base">
                로그인하면 바로 시작할 수 있습니다. 설치할 것도, 설정할 것도 없습니다.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth/signin"
                  className="btn-neo border-transparent bg-brand px-6 py-3.5 text-sm text-white hover:bg-brand-strong hover:text-white"
                >
                  <Lock className="h-4 w-4" />
                  로그인하고 시작하기
                </Link>
                <Link
                  href="/landing/guide"
                  className="btn-neo px-6 py-3.5 text-sm"
                >
                  기능 더 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <div className="landing-section-divider" />

        {/* FAQ */}
        <FaqAccordion />
      </main>
      <LandingFooter />
    </div>
  );
}
