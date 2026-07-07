'use client';

import { ChevronDown, Mic, Sparkles } from 'lucide-react';

/** 회의 만들기 화면 목업 */
export function FlowMockNewMeeting() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* 헤더 */}
      <div className="border-b border-[var(--line-soft)] bg-white/40 px-4 py-2.5">
        <span className="font-semibold">새 회의 시작</span>
      </div>

      <div className="space-y-3 p-4">
        {/* 제목 */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-muted">회의 제목</label>
          <div className="rounded-lg border border-[var(--line-soft)] bg-white/80 px-3 py-2 text-muted">
            주간 정기회의
          </div>
        </div>

        {/* 안건 */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-muted">안건 (선택)</label>
          <div className="rounded-lg border border-dashed border-[var(--line-soft)] bg-white/50 px-3 py-2 text-muted">
            1. 배포 일정 확인 2. API 개선 논의...
          </div>
        </div>

        {/* 프롬프트 선택 */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-muted">문서 타입</label>
          <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-brand" />
              <span className="font-semibold text-brand">회의록 (기본)</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted" />
          </div>
        </div>

        {/* 고급 설정 미리보기 */}
        <div className="rounded-lg border border-[var(--line-soft)] bg-white/40 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span>전사: 실시간</span>
            <span className="text-[var(--line-strong)]">·</span>
            <span>언어: 자동 감지</span>
            <span className="text-[var(--line-strong)]">·</span>
            <span>번역: 없음</span>
          </div>
        </div>

        {/* 시작 버튼 */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 font-semibold text-white">
          <Mic className="h-3.5 w-3.5" />
          회의 시작
        </div>
      </div>
    </div>
  );
}
