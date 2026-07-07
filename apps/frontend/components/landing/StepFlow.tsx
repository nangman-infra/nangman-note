'use client';

import { Mic, Radio, Sparkles } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const steps = [
  {
    num: '01',
    icon: Mic,
    title: '마이크를 켜세요',
    description:
      '제목을 입력하고 문서 타입을 고르면 준비 끝. 회의 중에는 노트에 집중하세요.',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    num: '02',
    icon: Radio,
    title: '자동으로 기록됩니다',
    description:
      '대화가 실시간으로 텍스트가 되고, 누가 말했는지 자동으로 구분됩니다.',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    num: '03',
    icon: Sparkles,
    title: '회의록이 완성됩니다',
    description:
      '종료 버튼을 누르면 AI가 주제를 나누고 구조화된 문서를 만들어줍니다. 마음에 안 들면 다시 생성할 수 있어요.',
    color: 'text-amber-600 bg-amber-50',
  },
] as const;

export function StepFlow() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <ScrollReveal>
          <p className="text-center text-xs font-semibold tracking-widest text-muted">
            HOW IT WORKS
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">
            3단계로 완성되는 회의록
          </h2>
        </ScrollReveal>

        <div className="relative mt-12 grid gap-6 sm:grid-cols-3">
          {/* 연결선 (데스크톱) */}
          <div className="absolute left-0 right-0 top-14 hidden h-px bg-[var(--line-soft)] sm:block" aria-hidden="true" />

          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 120}>
              <div className="surface-card relative flex flex-col items-center p-6 text-center transition hover:-translate-y-1 hover:border-[var(--line-strong)]">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${step.color}`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="mt-3 text-[11px] font-bold tracking-widest text-muted">
                  STEP {step.num}
                </span>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={400}>
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[var(--line-soft)] bg-white/60 p-5 text-center">
            <p className="text-sm text-muted">
              💡 문서의 기본 구조는 유지하면서, <span className="font-semibold text-foreground">어떤 부분을 강조할지 직접 조정</span>할 수 있습니다.
              같은 회의를 다른 관점으로 다시 정리하는 것도 가능합니다.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
