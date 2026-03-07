'use client';

import { ScrollReveal } from './ScrollReveal';
import { CountUp } from './CountUp';

const stats = [
  { value: 7, unit: '개 언어', desc: '자동 감지 및 실시간 번역' },
  { value: 8, unit: '명까지', desc: '화자 자동 구분' },
  { value: 3, unit: '가지 포맷', desc: 'PDF · DOCX · Markdown 내보내기' },
] as const;

const testimonials = [
  {
    quote: '2시간짜리 정기회의 후 매번 30분씩 정리했는데, 이제 회의 끝나자마자 팀에 공유합니다. 정리 시간이 사라졌어요.',
    role: '스타트업 PM',
  },
  {
    quote: '강의 녹음을 올리면 개념별로 정리해줘서 복습 시간이 반으로 줄었어요. 시험 기간에 특히 유용합니다.',
    role: '대학원생',
  },
  {
    quote: '멘토링 후 "뭐가 핵심이었지?" 하고 고민하던 시간이 없어졌어요. 할 일 목록이 바로 나옵니다.',
    role: '주니어 개발자',
  },
] as const;

export function SocialProof() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        {/* 숫자 통계 */}
        <ScrollReveal>
          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.desc} className="surface-card p-5 text-center">
                <p className="text-3xl font-bold text-brand sm:text-4xl">
                  <CountUp target={s.value} />
                  <span className="ml-0.5 text-base font-semibold">{s.unit}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* 사용자 후기 */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.role} delay={i * 100}>
              <div className="surface-card flex h-full flex-col justify-between p-5">
                <p className="text-sm leading-relaxed text-muted">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-4 text-xs font-semibold">— {t.role}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
