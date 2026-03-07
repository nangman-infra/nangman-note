'use client';

import { CheckCircle2, Cloud, FileText, Loader2, Mic } from 'lucide-react';

/** AI 처리 프로그레스 목업 */
export function FlowMockProcessing() {
  const steps = [
    { icon: Cloud, label: '오디오 업로드', status: 'done' as const },
    { icon: Mic, label: '음성 → 텍스트 변환', status: 'done' as const },
    { icon: FileText, label: 'AI 회의록 생성', status: 'active' as const },
    { icon: CheckCircle2, label: '완료', status: 'pending' as const },
  ];

  return (
    <div className="surface-card overflow-hidden p-5 text-[11px]">
      <p className="mb-4 text-center text-xs font-semibold">회의록을 만들고 있습니다</p>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                step.status === 'done'
                  ? 'bg-brand/10 text-brand'
                  : step.status === 'active'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : step.status === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <step.icon className="h-3.5 w-3.5" />
              )}
            </div>

            {/* 연결선 */}
            <div className="flex flex-1 items-center gap-2">
              <span
                className={`text-[11px] font-medium ${
                  step.status === 'done'
                    ? 'text-brand'
                    : step.status === 'active'
                      ? 'text-amber-700'
                      : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {step.status === 'active' && (
                <span className="text-[9px] text-muted">약 1~3분 소요</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
