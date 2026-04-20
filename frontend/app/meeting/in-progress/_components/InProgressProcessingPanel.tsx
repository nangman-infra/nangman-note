'use client';

import { ArrowLeft } from 'lucide-react';
import { ProcessingProgress } from '@/domains/meeting/components/ProcessingProgress';

type UploadState = React.ComponentProps<typeof ProcessingProgress>['uploadState'];

interface InProgressProcessingPanelProps {
  meetingId: string;
  uploadState: UploadState;
  uploadProgress: number;
  uploadError: string | null;
  onComplete: () => void;
  onGoHome: () => void;
}

export function InProgressProcessingPanel({
  meetingId,
  uploadState,
  uploadProgress,
  uploadError,
  onComplete,
  onGoHome,
}: InProgressProcessingPanelProps) {
  return (
    <div className="mx-auto w-full max-w-lg p-4">
      <ProcessingProgress
        meetingId={meetingId}
        uploadState={uploadState}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        onComplete={onComplete}
      />
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onGoHome}
          className="btn-secondary inline-flex text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          홈으로 이동 (백그라운드에서 계속 처리)
        </button>
      </div>
    </div>
  );
}
