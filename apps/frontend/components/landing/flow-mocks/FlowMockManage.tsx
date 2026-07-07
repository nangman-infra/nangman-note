'use client';

import { BookOpenText, Edit3, GraduationCap, Users } from 'lucide-react';

/**
 * 프롬프트 관리 화면 목업 — 실제 Prompt Management (Phase 5) 축소판.
 *
 * 참조: frontend/app/settings/page.tsx
 * - 상단 헤더: eyebrow "Prompt Management" + Manrope 헤드라인 "프롬프트 관리"
 * - System Library 섹션: 3열 템플릿 카드 그리드
 *   (아이콘 타일 + 이름 + 1줄 설명 + 문서 타입 라벨 + Edit 링크)
 * - Template Editor 섹션: 기본값 폼 2행 (tonal select, 라벨 + 미니 select)
 *
 * No-Line 규칙: 모든 구획을 배경 톤 전환으로만 나눈다 (border-* 미사용).
 */
export function FlowMockManage() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* ── 헤더: eyebrow + Manrope 헤드라인 ── */}
      <header className="px-3 pb-2 pt-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
          Prompt Management
        </p>
        <h2 className="mt-0.5 font-headline text-[14px] font-extrabold leading-tight tracking-tight text-slate-900">
          프롬프트 관리
        </h2>
      </header>

      {/* ── System Library: 3열 템플릿 카드 그리드 ── */}
      <section className="px-3 pb-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            System Library
          </p>
          <span className="text-[8px] font-semibold text-[var(--ink-muted)]">
            3개 템플릿
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-1.5" role="list">
          <TemplateMiniCard
            icon={Users}
            tone="bg-indigo-50 text-indigo-600"
            name="일일 스탠드업"
            description="팀 단위 진행 현황·블로커·다음 단계를 간결하게 정리."
            typeLabel="회의"
          />
          <TemplateMiniCard
            icon={BookOpenText}
            tone="bg-amber-50 text-amber-700"
            name="UX 강의"
            description="강의 핵심 주제와 질의응답을 장별로 구조화."
            typeLabel="강의"
          />
          <TemplateMiniCard
            icon={GraduationCap}
            tone="bg-cyan-50 text-cyan-700"
            name="시니어 멘토링"
            description="피드백·액션 아이템·후속 과제 중심으로 요약."
            typeLabel="멘토링"
          />
        </ul>
      </section>

      {/* ── Template Editor: 기본값 설정 (tonal surface-container-low) ── */}
      <section className="bg-[var(--surface-container-low)] px-3 py-2.5">
        <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Template Editor
        </p>
        <div className="space-y-1.5">
          <DefaultFormRow
            label="기본 프롬프트"
            value="일일 스탠드업"
          />
          <DefaultFormRow
            label="기본 전사 모드"
            value="Realtime (실시간 전사)"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * 축소판 템플릿 카드 — surface-card 위에 올라가는 한 단계 리프트 카드.
 * tonal 타일 아이콘 + 이름 + 1줄 설명 + 하단 메타 라인(타입 · Edit).
 */
function TemplateMiniCard({
  icon: Icon,
  tone,
  name,
  description,
  typeLabel,
}: {
  icon: typeof Users;
  tone: string;
  name: string;
  description: string;
  typeLabel: string;
}) {
  return (
    <li className="flex flex-col rounded-lg bg-white/80 p-2 shadow-sm">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${tone}`}
        aria-hidden="true"
      >
        <Icon className="h-3 w-3" />
      </span>
      <p className="mt-1.5 font-headline text-[10px] font-bold leading-tight tracking-tight text-slate-900">
        {name}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[8px] leading-snug text-[var(--ink-subtle)]">
        {description}
      </p>
      <div className="mt-auto flex items-center justify-between pt-1.5">
        <span className="text-[7px] font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
          {typeLabel}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-brand">
          <Edit3 className="h-2 w-2" aria-hidden="true" />
          Edit
        </span>
      </div>
    </li>
  );
}

/**
 * Template Editor 기본값 행 — 라벨 + 톤 배경의 미니 select 목업.
 * No-Line 규칙: border 없이 흰 배경 + 작은 섀도우로 select 느낌을 낸다.
 */
function DefaultFormRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-semibold text-[var(--ink-subtle)]">
        {label}
      </span>
      <span className="inline-flex min-w-[110px] items-center justify-between gap-1 rounded-md bg-white px-1.5 py-0.5 text-[8px] font-medium text-slate-900 shadow-sm">
        <span className="truncate">{value}</span>
        <span aria-hidden="true" className="text-[var(--ink-muted)]">
          ▾
        </span>
      </span>
    </div>
  );
}
