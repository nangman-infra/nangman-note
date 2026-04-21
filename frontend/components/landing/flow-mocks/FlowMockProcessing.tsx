'use client';

import { CheckCircle2, Cloud, FileText, Loader2, Mic } from 'lucide-react';

type FlowMockStepStatus = 'done' | 'active' | 'pending';

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
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
	            <div
	              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
	                getStepIconFrameClassName(step.status)
	              }`}
	            >
	              {renderStepIcon(step)}
	            </div>

            {/* 연결선 */}
            <div className="flex flex-1 items-center gap-2">
	              <span
	                className={`text-[11px] font-medium ${
	                  getStepLabelClassName(step.status)
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

function getStepIconFrameClassName(status: FlowMockStepStatus): string {
  if (status === 'done') return 'bg-brand/10 text-brand';
  if (status === 'active') return 'bg-amber-50 text-amber-600';
  return 'bg-gray-100 text-gray-400';
}

function getStepLabelClassName(status: FlowMockStepStatus): string {
  if (status === 'done') return 'text-brand';
  if (status === 'active') return 'text-amber-700';
  return 'text-gray-400';
}

function renderStepIcon(step: {
  icon: React.ComponentType<{ className?: string }>;
  status: FlowMockStepStatus;
}) {
  const StepIcon = step.icon;

  if (step.status === 'done') {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (step.status === 'active') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  return <StepIcon className="h-3.5 w-3.5" />;
}
