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
        statusClassName="bg-white/10 text-white/70"
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
        statusClassName="bg-white/10 text-white/70"
      >
        <TranscriptPanelEmptyState variant="batch" />
      </TranscriptPanelFrame>
    );
  }

  const statusLabel = getRealtimeStatusLabel({ isConnected, hasActiveSession });
  const statusClassName = getRealtimeStatusClassName({
    isConnected,
    hasActiveSession,
  });

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
      <div className="border-t border-white/[0.06] bg-black/20 px-3 py-2">
        <div className="data-mono flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={toggleFollowLive}
            className={`rounded-[6px] border px-2 py-1 transition ${
              followLive
                ? 'border-seafoam/40 bg-seafoam/15 text-seafoam-bright'
                : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            자동 스크롤 {followLive ? 'ON' : 'OFF'}
          </button>

          {showJumpToLatest ? (
            <button
              type="button"
              onClick={() => scrollToBottom({ forceFollow: true })}
              className="inline-flex items-center gap-1 rounded-[6px] border border-white/10 bg-white/5 px-2 py-1 text-white/80 transition hover:bg-white/10"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              최신으로 이동
            </button>
          ) : (
            <span className="text-white/40">최신 전사 위치</span>
          )}
        </div>
      </div>
    </TranscriptPanelFrame>
  );
}

function getRealtimeStatusLabel({
  isConnected,
  hasActiveSession,
}: {
  isConnected: boolean;
  hasActiveSession: boolean;
}): string {
  if (!isConnected) return '연결 중...';
  if (hasActiveSession) return '전사 중';
  return '대기 중';
}

function getRealtimeStatusClassName({
  isConnected,
  hasActiveSession,
}: {
  isConnected: boolean;
  hasActiveSession: boolean;
}): string {
  if (!isConnected) return 'bg-[#f2936b]/20 text-[#f2936b]';
  if (hasActiveSession) return 'bg-seafoam/20 text-seafoam-bright animate-pulse';
  return 'bg-white/10 text-white/70';
}
