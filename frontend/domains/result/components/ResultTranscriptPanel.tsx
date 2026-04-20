import { StatusBanner } from '@/components/feedback/StatusBanner';
import type { ResultTabTranscriptSegment } from '../api/resultTabDataApi';
import { formatSegmentTime } from './resultViewerHelpers';

interface ResultTranscriptPanelProps {
  error?: string | null;
  transcripts: ResultTabTranscriptSegment[];
}

export function ResultTranscriptPanel({
  error,
  transcripts,
}: ResultTranscriptPanelProps) {
  if (error) {
    return (
      <div className="surface-card p-5">
        <StatusBanner
          variant="error"
          title="전사 데이터를 불러오지 못했습니다"
          message={error}
        />
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className="surface-card p-5">
        <p className="text-center text-sm text-muted">
          아직 수집된 전사 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <div className="space-y-2">
        {transcripts.map((segment) => (
          <div key={segment.id} className="flex gap-3 text-sm">
            <span className="shrink-0 font-mono text-xs text-muted">
              [{formatSegmentTime(segment.startTime)} ~{' '}
              {formatSegmentTime(segment.endTime)}]
            </span>
            <span>{segment.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
