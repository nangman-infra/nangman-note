'use client';

import { Mic, Brain, FileStack } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const values = [
  {
    icon: Mic,
    title: '실시간 전사',
    description: '회의 중 말하는 내용이 바로 텍스트로 변환됩니다. 7개 언어를 자동으로 감지하고, 누가 말했는지도 구분합니다.',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    icon: Brain,
    title: 'AI 구조화',
    description: '회의가 끝나면 AI가 주제별로 나누고, 결정사항과 할 일을 자동으로 뽑아줍니다.',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    icon: FileStack,
    title: '3가지 맞춤 문서',
    description: '같은 녹음이라도 회의록 · 강의노트 · 멘토링 정리 중 원하는 형태로 받을 수 있습니다.',
    color: 'text-amber-600 bg-amber-50',
  },
] as const;

export function ValueCards() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <ScrollReveal>
          <p className="text-center text-xs font-semibold tracking-widest text-muted">
            CORE VALUE
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">
            회의록, 이렇게 달라집니다
          </h2>
        </ScrollReveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {values.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 100}>
              <div className="surface-card flex h-full flex-col p-6 transition hover:-translate-y-1 hover:border-[var(--line-strong)]">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${v.color}`}>
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {v.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
