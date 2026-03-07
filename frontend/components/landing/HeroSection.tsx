'use client';

import Link from 'next/link';
import { ArrowRight, Eye } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { AppPreview } from './AppPreview';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36">
      {/* 히어로 전용 배경 gradient blob */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[radial-gradient(ellipse,rgba(15,118,110,0.12)_0%,transparent_70%)]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[500px] rounded-full bg-[radial-gradient(ellipse,rgba(217,119,6,0.08)_0%,transparent_70%)]" />
      </div>
      <div className="mx-auto max-w-6xl px-5">
        {/* 배지 — CSS 초기 로드 애니메이션 */}
        <div className="landing-rise flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand backdrop-blur">
            🎙️ AI-Powered Meeting Notes
          </span>
        </div>

        {/* 헤드라인 */}
        <div className="landing-rise landing-rise-d1">
          <h1 className="mx-auto mt-6 max-w-3xl text-center text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            회의가 끝나면,{' '}
            <span className="landing-gradient-text">회의록은 이미 완성</span>
            되어 있습니다
          </h1>
        </div>

        <div className="landing-rise landing-rise-d2">
          <p className="mx-auto mt-5 max-w-xl text-center text-base text-muted sm:text-lg">
            매번 회의록 정리에 30분을 쓰고 있다면 — 실시간 전사와 노트를 결합해
            AI가 주제를 분리하고 구조화된 문서를 자동 생성합니다.
          </p>
        </div>

        {/* CTA */}
        <div className="landing-rise landing-rise-d3">
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/landing/start"
              className="btn-neo border-transparent bg-brand px-6 py-3.5 text-sm text-white shadow-[0_2px_16px_rgba(15,118,110,0.35)] hover:bg-brand-strong hover:text-white hover:shadow-[0_4px_24px_rgba(15,118,110,0.45)]"
            >
              무료로 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/landing/guide"
              className="btn-neo px-5 py-3 text-sm"
            >
              <Eye className="h-4 w-4" />
              어떻게 사용하나요?
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
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
