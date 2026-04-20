import { Languages, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
import type { FinalSegment, PartialSegment } from '../stores/transcriptionStore';
import { formatSegmentTime, isKeyPointSegment } from './transcriptPanelUtils';
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
      {isEmpty ? <TranscriptPanelEmptyState variant="empty" /> : null}

      {segments.map((segment) => (
        <TranscriptSegmentItem key={segment.resultId} segment={segment} />
      ))}

      {partial ? <PartialTranscriptSegment partial={partial} /> : null}
    </div>
  );
}

function TranscriptSegmentItem({ segment }: { segment: FinalSegment }) {
  if (isKeyPointSegment(segment)) {
    return (
      <div
        className="ai-card-accent group rounded-r-lg px-3 py-2"
        data-key-point="true"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {formatSegmentTime(segment.startTime)}
          </span>
          <SegmentText segment={segment} />
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
          {formatSegmentTime(segment.startTime)}
        </span>
        <SegmentText segment={segment} />
      </div>
    </div>
  );
}

function SegmentText({ segment }: { segment: FinalSegment }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-relaxed text-slate-100">{segment.text}</p>
      {segment.translatedText ? (
        <p className="mt-0.5 text-sm leading-relaxed text-cyan-300">
          <Languages className="mr-1 inline-block h-3 w-3" />
          {segment.translatedText}
        </p>
      ) : null}
      {!segment.translatedText && segment.translationStatus === 'pending' ? (
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
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
        <span className="mt-0.5 shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
          {formatSegmentTime(partial.startTime)}
        </span>
        <p className="min-w-0 flex-1 text-sm italic leading-relaxed text-slate-400">
          {partial.text}
        </p>
      </div>
    </div>
  );
}
