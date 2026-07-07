import type { ComponentType } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { ProcessingStep } from './ProcessingProgress';

interface ProcessingStepItemProps {
  step: {
    key: ProcessingStep;
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  };
  currentStep: ProcessingStep;
  isActive: boolean;
  isDone: boolean;
  isPending: boolean;
  uploadProgress: number;
  showUploadProgress: boolean;
}

export function ProcessingStepItem({
  step,
  currentStep,
  isActive,
  isDone,
  isPending,
  uploadProgress,
  showUploadProgress,
}: ProcessingStepItemProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${getStepContainerClassName({
        isActive,
        isDone,
      })}`}
    >
      <div
        className={`mt-0.5 rounded-full p-1.5 ${getStepIconClassName({
          isActive,
          isDone,
        })}`}
      >
        {renderStepIcon({ step, currentStep, isActive, isDone })}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            isPending ? 'text-slate-400' : ''
          }`}
        >
          {step.label}
        </p>
        {(isActive || isDone) && (
          <p className="mt-0.5 text-xs text-muted">{step.description}</p>
        )}
        {showUploadProgress && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getStepContainerClassName({
  isActive,
  isDone,
}: {
  isActive: boolean;
  isDone: boolean;
}): string {
  if (isActive) return 'border-brand/30 bg-brand/5';
  if (isDone) return 'border-emerald-200 bg-emerald-50/50';
  return 'border-[var(--line-soft)] bg-white/50 opacity-50';
}

function getStepIconClassName({
  isActive,
  isDone,
}: {
  isActive: boolean;
  isDone: boolean;
}): string {
  if (isActive) return 'bg-brand/15 text-brand';
  if (isDone) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-400';
}

function renderStepIcon({
  step,
  currentStep,
  isActive,
  isDone,
}: {
  step: ProcessingStepItemProps['step'];
  currentStep: ProcessingStep;
  isActive: boolean;
  isDone: boolean;
}) {
  const StepIcon = step.icon;

  if (isActive && currentStep !== 'completed') {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (isDone) {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  return <StepIcon className="h-4 w-4" />;
}
