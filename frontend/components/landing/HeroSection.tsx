'use client';

import Link from 'next/link';
import { ArrowRight, Eye } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { AppPreview } from './AppPreview';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36">
      {/* Signature halftone field — spectrum gradient lives only here */}
      <div className="glow-field glow-field--hero -z-10" aria-hidden="true" />
      <div className="ember-orb -right-40 top-10 -z-10 hidden h-[640px] w-[640px] opacity-35 blur-3xl lg:block" aria-hidden="true" />
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Tag with dot */}
        {/* 헤드라인 */}
        <div className="landing-rise landing-rise-d1">
          <h1 className="font-display mx-auto max-w-3xl text-center text-[40px] text-[var(--ink-strong)] sm:text-[48px] lg:text-[54px]">
            회의가 끝나면,{' '}
            <span className="landing-gradient-text">회의록은 이미 완성</span>
            되어 있습니다
          </h1>
        </div>

        <div className="landing-rise landing-rise-d2">
          <p className="mx-auto mt-8 max-w-xl text-center text-base font-light text-[var(--ink-subtle)] sm:text-lg">
            매번 회의록 정리에 30분을 쓰고 있다면 — 실시간 전사와 노트를 결합해
            AI가 주제를 분리하고 구조화된 문서를 자동 생성합니다.
          </p>
        </div>

        {/* CTA */}
        <div className="landing-rise landing-rise-d3">
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/landing/start" className="btn-primary inline-flex">
              무료로 시작하기
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link href="/landing/guide" className="btn-secondary inline-flex !px-6">
              <Eye className="h-4 w-4" strokeWidth={1.75} />
              어떻게 사용하나요?
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-[var(--ink-muted)]">
            설치 없음 · 로그인만으로 바로 시작 · 데이터 자체 호스팅
          </p>
        </div>

        {/* 앱 프리뷰 — 이건 below-the-fold이므로 ScrollReveal 유지 */}
        <ScrollReveal className="mt-14 sm:mt-20">
          <AppPreview />
        </ScrollReveal>
      </div>
    </section>
  );
}
