'use client';

import { Mic, Square, Timer } from 'lucide-react';

/** 회의 진행 중 화면 목업 */
export function FlowMockInProgress() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* 상단 컨트롤바 */}
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-white/40 px-4 py-2">
        <span className="font-semibold">주간 정기회의</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700">
            <Mic className="h-2.5 w-2.5" /> 녹음 중
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <Timer className="h-3 w-3" /> 24:35
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-rose-500 px-2 py-1 text-[9px] font-semibold text-white">
            <Square className="h-2.5 w-2.5" /> 종료
          </span>
        </div>
      </div>

      {/* 2-column 본문 */}
      <div className="grid grid-cols-[1fr_140px] divide-x divide-[var(--line-soft)]" style={{ height: 200 }}>
        {/* 왼쪽: 노트 에디터 */}
        <div className="flex flex-col">
          <div className="border-b border-[var(--line-soft)] bg-white/30 px-3 py-1.5 text-[10px] font-semibold text-muted">
            노트 편집기
            <span className="ml-2 text-[9px] font-normal text-brand">자동 저장됨</span>
          </div>
          <div className="flex-1 p-3 text-[10px] leading-relaxed text-muted">
            <p className="font-semibold text-foreground">## 배포 일정</p>
            <p>- 3/15 스테이징 배포 예정</p>
            <p>- QA 시나리오 김OO 담당</p>
            <p className="mt-2 font-semibold text-foreground">## API 개선</p>
            <p>- 캐시 레이어 도입 논의</p>
            <p className="mt-1 text-[9px] italic text-brand/60">마크다운으로 자유롭게 작성...</p>
          </div>
        </div>

        {/* 오른쪽: 전사 패널 */}
        <div className="flex flex-col">
          <div className="border-b border-[var(--line-soft)] bg-white/30 px-2 py-1.5 text-[9px] font-semibold tracking-wide text-muted">
            TRANSCRIPTION
          </div>
          <div className="flex-1 space-y-1.5 overflow-hidden p-2 text-[9px]">
            <div>
              <span className="text-[8px] text-muted">00:12</span>
              <span className="ml-1 rounded bg-teal-50 px-1 text-[8px] font-semibold text-teal-700">화자1</span>
              <p className="mt-0.5">배포 일정부터 확인하겠습니다</p>
            </div>
            <div>
              <span className="text-[8px] text-muted">00:28</span>
              <span className="ml-1 rounded bg-amber-50 px-1 text-[8px] font-semibold text-amber-700">화자2</span>
              <p className="mt-0.5">스테이징은 15일로 잡았습니다</p>
            </div>
            <div>
              <span className="text-[8px] text-muted">01:05</span>
              <span className="ml-1 rounded bg-teal-50 px-1 text-[8px] font-semibold text-teal-700">화자1</span>
              <p className="mt-0.5">QA 시나리오는 누가...</p>
            </div>
            <div className="rounded bg-amber-50/60 px-1.5 py-1 italic text-amber-700">
              캐시 레이어를 도입하면 응답 속도가...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
