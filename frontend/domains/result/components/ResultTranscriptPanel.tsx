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
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-3">
        <span className="tag-dot">Transcript</span>
        <span className="data-mono text-[11px] text-[var(--ink-muted)]">{transcripts.length} segments</span>
      </div>
      <div className="divide-y divide-[var(--line-soft)]">
        {transcripts.map((segment) => (
          <div key={segment.id} className="flex gap-4 px-5 py-3 text-sm">
            <span className="data-mono shrink-0 pt-0.5 text-[11px] text-electric">
              {formatSegmentTime(segment.startTime)}
            </span>
            {segment.speakerLabel ? (
              <span
                className={`inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 text-[10px] font-medium ${getResultSpeakerBadgeClass(segment.speakerLabel)}`}
              >
                {getResultSpeakerDisplayName(segment.speakerLabel)}
              </span>
            ) : null}
            <span className="leading-relaxed text-[var(--ink-subtle)]">{segment.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RESULT_SPEAKER_BADGE_CLASSES = [
  'bg-[var(--tertiary-fixed)] text-electric',
  'bg-[var(--tertiary-fixed)] text-[var(--tertiary)]',
  'bg-[var(--info-soft)] text-[var(--info)]',
  'bg-[var(--accent-soft)] text-[var(--accent-text)]',
  'bg-[var(--surface-container)] text-[var(--ink-subtle)]',
  'bg-[var(--danger-soft)] text-[var(--danger)]',
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
