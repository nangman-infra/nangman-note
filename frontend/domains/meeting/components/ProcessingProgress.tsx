'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { CheckCircle2, Cloud, FileText, Mic } from 'lucide-react';
import { meetingApi } from '../api/meetingApi';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import type { MeetingStatusMessage } from '@/hooks/useMeetingStatus';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import { MeetingStatus } from '../types/meeting.types';
import { ProcessingStepItem } from './ProcessingStepItem';

type UploadState =
  | 'idle'
  | 'requesting-url'
  | 'uploading'
  | 'completed'
  | 'failed';

export type ProcessingStep = 'uploading' | 'transcribing' | 'generating' | 'completed' | 'failed';

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

function getCurrentStep(uploadState: UploadState, backendStep: ProcessingStep): ProcessingStep {
  if (uploadState === 'failed') return 'failed';
  if (uploadState === 'completed') return backendStep;
  return 'uploading';
}

function getUploadStepDescription(
  uploadState: UploadState,
  uploadProgress: number,
): string {
  if (uploadState === 'uploading') return `서버로 전송 중... ${uploadProgress}%`;
  if (uploadState === 'requesting-url') return 'URL 준비 중...';
  return '대기 중';
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

  const currentStep = getCurrentStep(uploadState, backendStep);
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
      description: getUploadStepDescription(uploadState, uploadProgress),
      icon: Cloud,
    },
    {
      key: 'transcribing',
      label: '전사 처리 중',
      description:
        '음성을 텍스트로 변환하고 있습니다. 오디오 길이에 따라 수 분 이상 걸릴 수 있습니다.',
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

          return (
            <ProcessingStepItem
              key={step.key}
              step={step}
              currentStep={currentStep}
              isActive={isActive}
              isDone={isDone}
              isPending={isPending}
              uploadProgress={uploadProgress}
              showUploadProgress={
                isActive && step.key === 'uploading' && uploadState === 'uploading'
              }
            />
          );
        })}
      </div>
    </div>
  );
}
