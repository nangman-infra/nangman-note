'use client';

import { useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { FinalSegment, PartialSegment } from '../stores/transcriptionStore';
import { TranscriptPanelEmptyState } from './TranscriptPanelEmptyState';
import { TranscriptPanelFrame } from './TranscriptPanelFrame';
import { TranscriptSegmentList } from './TranscriptSegmentList';
import { useTranscriptAutoFollow } from './useTranscriptAutoFollow';

interface TranscriptPanelProps {
  segments: FinalSegment[];
  partial: PartialSegment | null;
  isConnected: boolean;
  hasActiveSession: boolean;
  isRealtimeMode: boolean;
  micPermission: 'prompt' | 'granted' | 'denied' | 'unsupported';
  meetingId: string;
  error?: string | null;
}

export function TranscriptPanel({
  segments,
  partial,
  isConnected,
  hasActiveSession,
  isRealtimeMode,
  micPermission,
  meetingId,
  error,
}: TranscriptPanelProps) {
  const hasTranscriptData = useMemo(
    () => segments.length > 0 || Boolean(partial),
    [segments.length, partial],
  );
  const {
    scrollRef,
    followLive,
    showJumpToLatest,
    scrollToBottom,
    toggleFollowLive,
  } = useTranscriptAutoFollow({
    hasTranscriptData,
    partialText: partial?.text,
    segmentCount: segments.length,
  });

  if (micPermission === 'denied' || micPermission === 'unsupported') {
    return (
      <TranscriptPanelFrame
        title="노트 전용 모드"
        meetingId={meetingId}
        statusLabel="마이크 비활성"
        statusClassName="bg-slate-800 text-slate-300"
      >
        <TranscriptPanelEmptyState variant="mic-disabled" />
      </TranscriptPanelFrame>
    );
  }

  if (!isRealtimeMode) {
    return (
      <TranscriptPanelFrame
        title="배치 전사 대기"
        meetingId={meetingId}
        statusLabel="배치 모드"
        statusClassName="bg-slate-800 text-slate-300"
      >
        <TranscriptPanelEmptyState variant="batch" />
      </TranscriptPanelFrame>
    );
  }

  const statusLabel = !isConnected
    ? '연결 중...'
    : hasActiveSession
      ? '전사 중'
      : '대기 중';

  const statusClassName = !isConnected
    ? 'bg-amber-500/20 text-amber-300'
    : hasActiveSession
      ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
      : 'bg-slate-800 text-slate-300';

  return (
    <TranscriptPanelFrame
      title="실시간 전사"
      meetingId={meetingId}
      statusLabel={statusLabel}
      statusClassName={statusClassName}
      error={error}
    >
      <TranscriptSegmentList
        segments={segments}
        partial={partial}
        scrollRef={scrollRef}
      />
      <div className="bg-slate-950/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={toggleFollowLive}
            className={`rounded-full px-2 py-1 transition ${
              followLive
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            새 전사 자동 스크롤 {followLive ? 'ON' : 'OFF'}
          </button>

          {showJumpToLatest ? (
            <button
              type="button"
              onClick={() => scrollToBottom({ forceFollow: true })}
              className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-1 font-medium text-cyan-300 transition hover:bg-cyan-500/25"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              최신으로 이동
            </button>
          ) : (
            <span className="text-slate-500">최신 전사 위치</span>
          )}
        </div>
      </div>
    </TranscriptPanelFrame>
  );
}
