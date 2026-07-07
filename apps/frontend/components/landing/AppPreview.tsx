'use client';

import { FileText, Mic, NotebookText, Clock, Tag } from 'lucide-react';

/**
 * 앱 UI를 축소 재현한 CSS-only 목업.
 * 실제 데이터 없이 3-column 레이아웃의 느낌을 전달한다.
 */
export function AppPreview() {
  return (
    <div className="glass-surface mx-auto w-full max-w-5xl overflow-hidden" aria-hidden="true">
      {/* 모바일: 단일 컬럼 뷰어만 */}
      <div className="block sm:hidden">
        <MobilePreview />
      </div>
      {/* 데스크톱: 3-column */}
      <div className="hidden sm:grid sm:h-[480px] sm:grid-cols-[200px_260px_1fr]">
        {/* 사이드바 미니 */}
        <div className="flex flex-col gap-3 border-r border-[var(--line-soft)] bg-white/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-brand">
            <NotebookText className="h-3 w-3" />
            TransNote
          </div>
          <PreviewPill icon={<Clock className="h-3 w-3" />} label="오늘" active />
          <PreviewPill icon={<Clock className="h-3 w-3" />} label="최근" />
          <PreviewPill icon={<Clock className="h-3 w-3" />} label="전체" />
          <div className="mt-3 text-[9px] font-semibold tracking-wide text-muted">TAGS</div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-semibold text-teal-800">회의록</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-800">강의</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold text-sky-800">멘토링</span>
          </div>
        </div>

        {/* 회의 목록 미니 */}
        <div className="flex flex-col gap-2 border-r border-[var(--line-soft)] bg-white/30 p-3">
          <div className="text-[10px] font-semibold text-muted">회의 목록</div>
          <MeetingCardMini title="주간 정기회의" tag="회의록" tagColor="bg-teal-100 text-teal-800" active />
          <MeetingCardMini title="UX 리서치 강의" tag="강의" tagColor="bg-amber-100 text-amber-800" />
          <MeetingCardMini title="시니어 멘토링" tag="멘토링" tagColor="bg-sky-100 text-sky-800" />
          <MeetingCardMini title="스프린트 회고" tag="회의록" tagColor="bg-teal-100 text-teal-800" />
        </div>

        {/* 결과 뷰어 미니 */}
        <div className="flex flex-col bg-white/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-lg bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand">
              <FileText className="mr-1 inline h-3 w-3" />
              AI 회의록
            </span>
            <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] text-muted">전사 원본</span>
            <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] text-muted">메모</span>
          </div>

          <div className="flex-1 space-y-2.5 overflow-hidden">
            <div className="text-sm font-semibold">주간 정기회의</div>
            <SkeletonBlock w="100%" h="8px" />
            <div className="text-[10px] font-semibold text-brand">📋 안건 1: 배포 일정 확인</div>
            <SkeletonBlock w="95%" h="6px" />
            <SkeletonBlock w="80%" h="6px" />
            <div className="mt-2 rounded-lg border border-[var(--line-soft)] bg-white/60 p-2">
              <div className="text-[9px] font-semibold text-brand">✅ 결정사항</div>
              <SkeletonBlock w="90%" h="5px" />
              <SkeletonBlock w="70%" h="5px" />
            </div>
            <div className="rounded-lg border border-[var(--line-soft)] bg-white/60 p-2">
              <div className="text-[9px] font-semibold text-amber-700">📌 액션아이템</div>
              <SkeletonBlock w="85%" h="5px" />
              <SkeletonBlock w="60%" h="5px" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-[var(--line-soft)] pt-2">
            <Mic className="h-3 w-3 text-rose-500" />
            <div className="flex-1">
              <SkeletonBlock w="100%" h="4px" accent />
              <SkeletonBlock w="65%" h="4px" accent />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 모바일 전용: 뷰어 패널만 보여주는 축소 프리뷰 */
function MobilePreview() {
  return (
    <div className="flex flex-col bg-white/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand">
          <FileText className="mr-1 inline h-3 w-3" />
          AI 회의록
        </span>
        <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] text-muted">전사 원본</span>
        <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] text-muted">메모</span>
      </div>
      <div className="space-y-2.5">
        <div className="text-sm font-semibold">주간 정기회의</div>
        <SkeletonBlock w="100%" h="8px" />
        <div className="text-[10px] font-semibold text-brand">📋 안건 1: 배포 일정 확인</div>
        <SkeletonBlock w="95%" h="6px" />
        <SkeletonBlock w="80%" h="6px" />
        <div className="mt-2 rounded-lg border border-[var(--line-soft)] bg-white/60 p-2">
          <div className="text-[9px] font-semibold text-brand">✅ 결정사항</div>
          <SkeletonBlock w="90%" h="5px" />
        </div>
        <div className="rounded-lg border border-[var(--line-soft)] bg-white/60 p-2">
          <div className="text-[9px] font-semibold text-amber-700">📌 액션아이템</div>
          <SkeletonBlock w="85%" h="5px" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--line-soft)] pt-2">
        <Mic className="h-3 w-3 text-rose-500" />
        <div className="flex-1">
          <SkeletonBlock w="100%" h="4px" accent />
          <SkeletonBlock w="65%" h="4px" accent />
        </div>
      </div>
    </div>
  );
}

function PreviewPill({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${
        active ? 'bg-brand/10 text-brand' : 'text-muted'
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function MeetingCardMini({
  title,
  tag,
  tagColor,
  active = false,
}: {
  title: string;
  tag: string;
  tagColor: string;
  active?: boolean;
}) {
  return (
    <div
      className={`cursor-default rounded-xl border p-2 transition hover:scale-[1.02] hover:border-brand/40 ${
        active
          ? 'border-brand/30 bg-brand/5'
          : 'border-[var(--line-soft)] bg-white/50'
      }`}
    >
      <div className="text-[10px] font-semibold leading-tight">{title}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <Tag className="h-2.5 w-2.5 text-muted" />
        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${tagColor}`}>
          {tag}
        </span>
      </div>
    </div>
  );
}

function SkeletonBlock({
  w,
  h,
  accent = false,
}: {
  w: string;
  h: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`mt-1 rounded-full ${accent ? 'bg-brand/15' : 'bg-[var(--ink-strong)]/8'}`}
      style={{ width: w, height: h }}
    />
  );
}
