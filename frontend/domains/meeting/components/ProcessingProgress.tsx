'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { CheckCircle2, Cloud, FileText, Loader2, Mic } from 'lucide-react';
import { meetingApi } from '../api/meetingApi';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import type { MeetingStatusMessage } from '@/hooks/useMeetingStatus';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import { MeetingStatus } from '../types/meeting.types';

type UploadState =
  | 'idle'
  | 'requesting-url'
  | 'uploading'
  | 'completed'
  | 'failed';

type ProcessingStep = 'uploading' | 'transcribing' | 'generating' | 'completed' | 'failed';

const PROCESSING_STATUS_POLL_INTERVAL_MS = 5000;
const ELAPSED_TIMER_INTERVAL_MS = 1000;
const LONG_PROCESSING_WARNING_SECONDS = 300;

interface ProcessingProgressProps {
  meetingId: string;
  uploadState: UploadState;
  uploadProgress: number;
  uploadError: string | null;
  onComplete?: () => void;
  onRetryUpload?: () => void;
  onContinueWithoutAudio?: () => void;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s.toString().padStart(2, '0')}초`;
}

function ElapsedProcessingTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, ELAPSED_TIMER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mt-2 text-xs text-muted">
      <span>경과 시간: {formatElapsed(elapsedSeconds)}</span>
      {elapsedSeconds > LONG_PROCESSING_WARNING_SECONDS && (
        <p className="mt-1 text-amber-600 font-medium">
          예상보다 오래 걸리고 있습니다. 완료 시 알려드립니다.
        </p>
      )}
    </div>
  );
}

export function ProcessingProgress({
  meetingId,
  uploadState,
  uploadProgress,
  uploadError,
  onComplete,
  onRetryUpload,
  onContinueWithoutAudio,
}: ProcessingProgressProps) {
  const [backendStep, setBackendStep] = useState<
    'uploading' | 'transcribing' | 'generating' | 'completed'
  >('uploading');
  const completeNotifiedRef = useRef(false);

  const notifyComplete = useCallback(() => {
    if (completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    completeNotifiedRef.current = false;
  }, [meetingId]);

  // WebSocket 으로 회의 상태 변경 수신 (폴링 대체)
  const handleStatusChange = useCallback(
    (message: MeetingStatusMessage) => {
      if (
        message.status === MeetingStatus.COMPLETED ||
        message.phase === 'completed'
      ) {
        setBackendStep('completed');
        notifyComplete();
        return;
      }

      if (message.phase === MeetingProcessingPhase.UPLOADING) {
        setBackendStep('uploading');
        return;
      }

      if (message.phase === 'transcribing') {
        setBackendStep('transcribing');
        return;
      }

      if (message.phase === 'generating') {
        setBackendStep('generating');
      }
    },
    [notifyComplete],
  );

  useMeetingStatus({
    meetingId,
    enabled: uploadState !== 'failed',
    onStatusChange: handleStatusChange,
  });

  // WebSocket 연결 실패/지연 시 폴백: 상태를 주기적으로 확인해서 완료 전환 보장
  useEffect(() => {
    if (uploadState !== 'completed') return;
    if (backendStep === 'completed') return;

    let disposed = false;
    const timerId = window.setInterval(async () => {
      try {
        const meeting = await meetingApi.get(meetingId);
        if (disposed) return;
        if (meeting.status === MeetingStatus.COMPLETED) {
          setBackendStep('completed');
          notifyComplete();
        }
      } catch {
        // 폴백 확인 실패는 무시하고 다음 틱에서 재시도
      }
    }, PROCESSING_STATUS_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timerId);
    };
  }, [backendStep, meetingId, notifyComplete, uploadState]);

  const currentStep: ProcessingStep =
    uploadState === 'failed'
      ? 'failed'
      : uploadState === 'completed'
        ? backendStep
        : 'uploading';
  const error =
    uploadState === 'failed'
      ? uploadError || '오디오 업로드에 실패했습니다.'
      : null;

  const steps: Array<{
    key: ProcessingStep;
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'uploading',
      label: '오디오 업로드',
      description:
        uploadState === 'uploading'
          ? `서버로 전송 중... ${uploadProgress}%`
          : uploadState === 'requesting-url'
            ? 'URL 준비 중...'
            : '대기 중',
      icon: Cloud,
    },
    {
      key: 'transcribing',
      label: '전사 처리 중',
      description: '음성을 텍스트로 변환하고 있습니다. 약 2~5분 소요됩니다.',
      icon: Mic,
    },
    {
      key: 'generating',
      label: 'AI 회의록 생성',
      description: '노트와 전사를 합쳐 회의록을 작성하고 있습니다.',
      icon: FileText,
    },
    {
      key: 'completed',
      label: '완료',
      description: '회의록이 준비되었습니다!',
      icon: CheckCircle2,
    },
  ];

  const stepOrder: ProcessingStep[] = ['uploading', 'transcribing', 'generating', 'completed'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold tracking-wide text-muted">PROCESSING</p>
      <h3 className="mt-1 text-lg font-semibold">회의 결과 생성 중</h3>

      {currentStep !== 'failed' && (
        <p className="mt-1 text-xs text-muted">
          다른 작업을 하셔도 됩니다. 완료 시 알려드립니다.
        </p>
      )}

      {currentStep !== 'failed' && currentStep !== 'completed' && (
        <ElapsedProcessingTimer key={`${meetingId}:${currentStep}`} />
      )}

      {error && currentStep === 'failed' ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetryUpload && (
              <button
                type="button"
                onClick={onRetryUpload}
                className="btn-neo inline-flex border-transparent bg-brand px-3 py-1.5 text-xs text-white hover:bg-brand-strong hover:text-white"
              >
                재시도
              </button>
            )}
            {onContinueWithoutAudio && (
              <button
                type="button"
                onClick={onContinueWithoutAudio}
                className="btn-neo inline-flex px-3 py-1.5 text-xs text-muted"
              >
                노트 기반으로 계속
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const isActive = step.key === currentStep;
          const isDone = currentIndex > index;
          const isPending = currentIndex < index;
          const StepIcon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                isActive
                  ? 'border-brand/30 bg-brand/5'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-[var(--line-soft)] bg-white/50 opacity-50'
              }`}
            >
              <div
                className={`mt-0.5 rounded-full p-1.5 ${
                  isActive
                    ? 'bg-brand/15 text-brand'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isActive && currentStep !== 'completed' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
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
                {isActive && step.key === 'uploading' && uploadState === 'uploading' && (
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
        })}
      </div>
    </div>
  );
}
