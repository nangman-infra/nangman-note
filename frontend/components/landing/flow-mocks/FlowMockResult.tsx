'use client';

import { Copy, Download, Edit3, FileText } from 'lucide-react';

/** 결과 뷰어 3탭 목업 */
export function FlowMockResult() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-white/40 px-4 py-2.5">
        <span className="font-semibold">주간 정기회의</span>
        <div className="flex items-center gap-1.5">
          <MockBtn icon={Edit3} label="편집" />
          <MockBtn icon={Copy} label="복사" />
          <MockBtn icon={Download} label="PDF" accent />
          <MockBtn icon={Download} label="DOCX" accent />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[var(--line-soft)]">
        <div className="border-b-2 border-brand px-4 py-2 text-[10px] font-semibold text-brand">
          <FileText className="mr-1 inline h-3 w-3" />
          회의록
        </div>
        <div className="px-4 py-2 text-[10px] text-muted">전사 원본</div>
        <div className="px-4 py-2 text-[10px] text-muted">메모</div>
      </div>

      {/* 구조화된 문서 */}
      <div className="space-y-2.5 p-4">
        <div className="text-xs font-bold">📋 안건 1: 배포 일정 확인</div>
        <div className="space-y-1 pl-3 text-[10px]">
          <p className="text-muted">스테이징 배포를 3/15로 확정하고, 프로덕션은 3/18로 진행하기로 했습니다.</p>
          <div className="mt-1.5 rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-1.5">
            <span className="text-[9px] font-semibold text-teal-700">✅ 결정사항</span>
            <p className="mt-0.5 text-teal-900">3/15 스테이징, 3/18 프로덕션 배포 확정</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5">
            <span className="text-[9px] font-semibold text-amber-700">📌 할 일</span>
            <p className="mt-0.5 text-amber-900">QA 시나리오 작성 — 김OO, 3/13까지</p>
          </div>
        </div>

        <div className="text-xs font-bold">📋 안건 2: API 응답 속도 개선</div>
        <div className="space-y-1 pl-3 text-[10px]">
          <p className="text-muted">Redis 캐시 레이어 도입에 합의했습니다.</p>
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-1.5">
            <span className="text-[9px] font-semibold text-teal-700">✅ 결정사항</span>
            <p className="mt-0.5 text-teal-900">캐시 레이어 도입 합의</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockBtn({ icon: Icon, label, accent = false }: { icon: typeof Edit3; label: string; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-medium ${accent ? 'bg-brand/10 text-brand' : 'bg-white/60 text-muted'}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
