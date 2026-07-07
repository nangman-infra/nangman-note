'use client';

import { useState } from 'react';
import { ScrollReveal } from './ScrollReveal';

const cases = [
  {
    id: 'auto-split',
    title: '2시간 정기회의 → 6개 안건 자동 분리',
    description:
      '긴 회의도 AI가 주제가 바뀌는 지점을 감지해 자동으로 나눕니다. 각 안건마다 논의 내용, 결정사항, 할 일이 정리됩니다.',
    before: '2시간 분량의 텍스트 덩어리 하나',
    after: '안건별로 나뉜 구조화 문서 (논의 → 결정 → 할 일)',
    /** 실제 결과물 미리보기 (사례 1만) */
    sampleResult: [
      {
        topic: '배포 일정 확인',
        decisions: ['3/15 스테이징, 3/18 프로덕션 배포 확정'],
        actions: ['QA 시나리오 작성 — 김OO, 3/13까지'],
      },
      {
        topic: 'API 응답 속도 개선',
        decisions: ['캐시 레이어 도입 합의'],
        actions: ['Redis 캐시 PoC — 이OO, 3/20까지'],
      },
      {
        topic: '디자인 시스템 v2 마이그레이션',
        decisions: ['컴포넌트 단위 점진 교체'],
        actions: ['Button/Input 우선 교체 — 박OO, 3/22까지'],
      },
    ],
  },
  {
    id: 'doc-types',
    title: '같은 녹음, 다른 결과물',
    description:
      '동일한 녹음에 다른 문서 타입을 적용하면 회의록·강의노트·멘토링 정리가 각각 다른 형태로 생성됩니다.',
    before: '회의 타입: 안건별 결정사항 중심 정리',
    after: '강의 타입: 개념별 정의·예시·핵심 포인트 정리',
    sampleResult: null,
  },
  {
    id: 'model-compare',
    title: 'AI 모델에 따라 품질이 다릅니다',
    description:
      'AI 모델에 따라 주제를 나누는 정확도가 달라집니다. Claude Sonnet 4.6은 복잡한 회의에서도 안건을 정확히 분리합니다.',
    before: '기본 모델: 전체를 하나의 주제로 처리',
    after: 'Claude Sonnet 4.6: 6개 안건을 정확히 분리',
    sampleResult: null,
  },
] as const;

export function UseCaseComparison() {
  const [active, setActive] = useState('auto-split');
  const current = cases.find((c) => c.id === active) ?? cases[0];

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <ScrollReveal>
          <p className="text-center text-xs font-semibold tracking-widest text-muted">
            USE CASES
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">
            실제 결과물로 확인하세요
          </h2>
        </ScrollReveal>

        {/* 사례 선택 탭 */}
        <ScrollReveal delay={100}>
          <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="사례 선택">
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                id={`case-tab-${c.id}`}
                aria-selected={active === c.id}
                aria-controls={`case-panel-${c.id}`}
                onClick={() => setActive(c.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active === c.id
                    ? 'bg-brand text-white'
                    : 'surface-card text-muted hover:text-foreground'
                }`}
              >
                {c.title.split('→')[0].trim()}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* 비교 카드 */}
        <ScrollReveal delay={200}>
          <div className="mx-auto mt-8 max-w-3xl" role="tabpanel" id={`case-panel-${current.id}`} aria-labelledby={`case-tab-${current.id}`}>
            <div className="surface-card p-6 sm:p-8">
              <h3 className="text-lg font-semibold">{current.title}</h3>
              <p className="mt-2 text-sm text-muted">{current.description}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-rose-600">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-[10px]">✕</span>
                    BEFORE
                  </p>
                  <p className="mt-2 text-sm">{current.before}</p>
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-teal-600">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-100 text-[10px]">✓</span>
                    AFTER
                  </p>
                  <p className="mt-2 text-sm font-medium">{current.after}</p>
                </div>
              </div>

              {/* 실제 결과물 풀 렌더링 (사례 1) */}
              {current.sampleResult && (
                <div className="mt-6">
                  <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted">
                    실제 AI 결과물 미리보기
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-[var(--line-soft)]">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--line-soft)] bg-brand/5">
                          <th className="px-4 py-2.5 text-xs font-semibold text-brand">안건</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-brand">결정사항</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-brand">액션아이템</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.sampleResult.map((row) => (
                          <tr key={row.topic} className="border-b border-[var(--line-soft)] last:border-b-0">
                            <td className="px-4 py-3 font-medium">{row.topic}</td>
                            <td className="px-4 py-3 text-muted">{row.decisions.join(', ')}</td>
                            <td className="px-4 py-3 text-muted">{row.actions.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
