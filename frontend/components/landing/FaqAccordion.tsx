'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const faqs = [
  {
    q: '어떤 언어를 지원하나요?',
    a: '한국어, 영어, 일본어, 중국어, 독일어, 프랑스어, 스페인어 총 7개 언어를 자동으로 감지합니다. 전사와 동시에 다른 언어로 번역하는 것도 가능합니다.',
  },
  {
    q: '데이터는 어디에 저장되나요?',
    a: '자체 호스팅 환경에서 운영됩니다. 모든 데이터는 AES 암호화되며, 사용자별로 완전히 격리됩니다.',
  },
  {
    q: '회의 중에 메모를 적으면 어떻게 되나요?',
    a: '회의 중 작성한 메모를 AI가 함께 참고합니다. 안건을 미리 적어두면 주제 분리가 더 정확해집니다.',
  },
  {
    q: '생성된 문서를 수정하거나 내보낼 수 있나요?',
    a: '네. 에디터에서 바로 수정할 수 있고, PDF · DOCX · Markdown 형식으로 내보낼 수 있습니다.',
  },
] as const;

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-5">
        <ScrollReveal>
          <p className="text-center text-xs font-semibold tracking-widest text-muted">
            FAQ
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">
            자주 묻는 질문
          </h2>
        </ScrollReveal>

        <div className="mt-8 space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <ScrollReveal key={faq.q} delay={i * 60}>
                <div className="surface-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold transition hover:bg-white/40"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                    id={`faq-question-${i}`}
                  >
                    {faq.q}
                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm leading-relaxed text-muted">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
