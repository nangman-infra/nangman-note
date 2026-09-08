import { Languages } from 'lucide-react';
import type { RefObject } from 'react';
import type { FinalSegment, PartialSegment } from '../stores/transcriptionStore';
import { formatSegmentTime, getSpeakerBadgeClass, getSpeakerDisplayName } from './transcriptPanelUtils';
import { TranscriptPanelEmptyState } from './TranscriptPanelEmptyState';

interface TranscriptSegmentListProps {
  segments: FinalSegment[];
  partial: PartialSegment | null;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function TranscriptSegmentList({
  segments,
  partial,
  scrollRef,
}: TranscriptSegmentListProps) {
  const isEmpty = segments.length === 0 && !partial;

  return (
    <div ref={scrollRef} className="scroll-muted flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {isEmpty ? <TranscriptPanelEmptyState variant="empty" /> : null}

      {segments.map((segment) => (
        <TranscriptSegmentItem key={segment.resultId} segment={segment} />
      ))}

      {partial ? <PartialTranscriptSegment partial={partial} /> : null}
    </div>
  );
}

function TranscriptSegmentItem({ segment }: { segment: FinalSegment }) {
  return (
    <div className="group">
      <div className="flex items-start gap-2">
        <span className="font-mono mt-0.5 shrink-0 rounded-[4px] px-1 py-0.5 text-[10px] text-electric">
          {formatSegmentTime(segment.startTime)}
        </span>
        {segment.speakerLabel ? (
          <span
            className={`mt-0.5 shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium ${getSpeakerBadgeClass(segment.speakerLabel)}`}
            title={`화자 ${getSpeakerDisplayName(segment.speakerLabel)}`}
          >
            {getSpeakerDisplayName(segment.speakerLabel)}
          </span>
        ) : null}
        <SegmentText segment={segment} />
      </div>
    </div>
  );
}

function SegmentText({ segment }: { segment: FinalSegment }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-relaxed text-[var(--ink-subtle)]">{segment.text}</p>
      {segment.translatedText ? (
        <p className="mt-0.5 text-sm leading-relaxed text-electric">
          <Languages className="mr-1 inline-block h-3 w-3" />
          {segment.translatedText}
        </p>
      ) : null}
      {!segment.translatedText && segment.translationStatus === 'pending' ? (
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-faint)]">
          번역 중...
        </p>
      ) : null}
    </div>
  );
}

function PartialTranscriptSegment({ partial }: { partial: PartialSegment }) {
  return (
    <div className="group opacity-80">
      <div className="flex items-start gap-2">
        <span className="font-mono mt-0.5 shrink-0 rounded-[4px] bg-ember/10 px-1.5 py-0.5 text-[10px] text-ember-text">
          {formatSegmentTime(partial.startTime)}
        </span>
        <p className="min-w-0 flex-1 text-sm italic leading-relaxed text-[var(--ink-muted)]">
          {partial.text}
        </p>
      </div>
    </div>
  );
}
