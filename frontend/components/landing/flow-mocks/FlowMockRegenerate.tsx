'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';

/** 프롬프트 변경 후 재생성 목업 */
export function FlowMockRegenerate() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      <div className="border-b border-[var(--line-soft)] bg-white/40 px-4 py-2.5">
        <span className="font-semibold">프롬프트 변경 후 재생성</span>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-[10px] text-muted">
          같은 전사 데이터로 다른 형태의 문서를 만들 수 있습니다.
        </p>

        {/* 현재 프롬프트 */}
        <div className="rounded-lg border border-[var(--line-soft)] bg-white/50 px-3 py-2">
          <span className="text-[9px] text-muted">현재</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">회의</span>
            <span className="font-medium">회의록 (기본)</span>
          </div>
        </div>

        {/* 변경할 프롬프트 */}
        <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
          <span className="text-[9px] text-brand">변경</span>
          <div className="mt-0.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">강의</span>
              <span className="font-medium">강의노트 (기본)</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted" />
          </div>
        </div>

        {/* 재생성 버튼 */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 font-semibold text-white">
          <RefreshCw className="h-3.5 w-3.5" />
          이 프롬프트로 재생성
        </div>
      </div>
    </div>
  );
}
