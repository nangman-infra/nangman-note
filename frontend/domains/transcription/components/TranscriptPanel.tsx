'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranscriptionStore } from '../stores/transcriptionStore';

interface TranscriptPanelProps {
  meetingId: string;
}

export function TranscriptPanel({ meetingId }: TranscriptPanelProps) {
  const { transcripts, isTranscriptExpanded, toggleExpanded } = useTranscriptionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isTranscriptExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, isTranscriptExpanded]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalDuration = transcripts.length > 0 ? transcripts[transcripts.length - 1].endTime : 0;

  return (
    <div className="border-t border-[var(--line-soft)]">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-white/60"
      >
        <div className="flex items-center gap-2">
          {isTranscriptExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="text-sm font-medium">전사 {isTranscriptExpanded ? '숨기기' : '보기'}</span>
          <span className="text-xs text-muted">({formatTime(totalDuration)})</span>
        </div>
        <span className="text-xs text-muted">meeting: {meetingId.slice(0, 8)}...</span>
      </button>

      {isTranscriptExpanded && (
        <div ref={scrollRef} className="scroll-muted h-64 space-y-2 overflow-y-auto bg-white/65 p-4">
          {transcripts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">전사 내용이 여기에 표시됩니다</p>
          ) : (
            transcripts.map((segment) => (
              <div key={segment.id} className="text-sm">
                <span className="font-mono text-xs text-muted">[{formatTime(segment.startTime)}]</span>
                <span className="ml-2 text-foreground">{segment.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
