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
            {segment.speakerLabel ? (
              <span
                className={`inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-semibold ${getResultSpeakerBadgeClass(segment.speakerLabel)}`}
              >
                {getResultSpeakerDisplayName(segment.speakerLabel)}
              </span>
            ) : null}
            <span>{segment.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RESULT_SPEAKER_BADGE_CLASSES = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-fuchsia-100 text-fuchsia-700',
] as const;

function getResultSpeakerDisplayName(speakerLabel: string): string {
  const match = /^spk[_-]?(\d+)$/i.exec(speakerLabel.trim());
  if (match) {
    return `화자 ${Number(match[1]) + 1}`;
  }
  return speakerLabel;
}

function getResultSpeakerBadgeClass(speakerLabel: string): string {
  const match = /(\d+)/.exec(speakerLabel);
  const index = match ? Number(match[1]) : 0;
  return RESULT_SPEAKER_BADGE_CLASSES[index % RESULT_SPEAKER_BADGE_CLASSES.length];
}
