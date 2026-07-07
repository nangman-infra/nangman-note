'use client';

import { useState } from 'react';
import { FileText, GraduationCap, Users } from 'lucide-react';

const tabs = [
  {
    id: 'meeting',
    label: '회의',
    icon: FileText,
    color: 'text-teal-700 bg-teal-50',
    structure: [
      '참여자',
      '안건별 (논의 → 결정 → 액션아이템 → 미해결)',
      '전체 요약',
      '키워드',
    ],
    example:
      '2시간 정기회의에서 안건을 자동으로 나누고, 각 안건마다 결정사항과 할 일을 정리합니다.',
  },
  {
    id: 'lecture',
    label: '강의',
    icon: GraduationCap,
    color: 'text-amber-700 bg-amber-50',
    structure: [
      '요약',
      '개념 (정의 · 예시 · 포인트)',
      '실습',
      '핵심 정리',
      '키워드',
    ],
    example:
      '강의 내용을 개념 단위로 정리하고, 각 개념의 정의·예시·핵심 포인트를 나눠줍니다.',
  },
  {
    id: 'mentoring',
    label: '멘토링',
    icon: Users,
    color: 'text-sky-700 bg-sky-50',
    structure: [
      '요약',
      '주제별 (팁 · 과제 · 조사 키워드 · 주의)',
      '가져갈 것',
      '키워드',
    ],
    example:
      '멘토의 조언을 주제별로 분류하고, 실행 과제와 조사할 키워드를 정리합니다.',
  },
] as const;

export function FeatureTab() {
  const [active, setActive] = useState<string>('meeting');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="surface-card overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-[var(--line-soft)]" role="tablist" aria-label="문서 타입 선택">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
              active === tab.id
                ? 'border-b-2 border-brand text-brand'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div
        className="p-5 sm:p-7"
        role="tabpanel"
        id={`tabpanel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
      >
        <div key={current.id} className="landing-tab-fade">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${current.color}`}>
              <current.icon className="h-3.5 w-3.5" />
              {current.label} 문서
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            {current.example}
          </p>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted">
              문서 구조
            </p>
            <ol className="space-y-1.5">
              {current.structure.map((item, i) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand/10 text-[10px] font-bold text-brand">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
