'use client';

import { useRef, useEffect } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TranscriptPanelProps {
  meetingId: string;
}

export function TranscriptPanel({ meetingId }: TranscriptPanelProps) {
  const { transcripts, isTranscriptExpanded, toggleExpanded } = useTranscriptionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
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

  const totalDuration = transcripts.length > 0 
    ? transcripts[transcripts.length - 1].endTime 
    : 0;

  return (
    <div className="border-t">
      <button
        onClick={toggleExpanded}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isTranscriptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="text-sm font-medium">
            전사 {isTranscriptExpanded ? '숨기기' : '보기'}
          </span>
          <span className="text-xs text-gray-500">
            ({formatTime(totalDuration)})
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {transcripts.length}개 세그먼트
        </span>
      </button>

      {isTranscriptExpanded && (
        <div 
          ref={scrollRef} 
          className="h-64 overflow-y-auto p-4 bg-gray-50 space-y-2"
        >
          {transcripts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              전사 내용이 여기에 표시됩니다
            </p>
          ) : (
            transcripts.map((segment) => (
              <div key={segment.id} className="text-sm">
                <span className="text-xs text-gray-500 font-mono">
                  [{formatTime(segment.startTime)}]
                </span>
                <span className="ml-2 text-gray-800">{segment.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
