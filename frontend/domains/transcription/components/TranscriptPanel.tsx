'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, Languages } from 'lucide-react';
import type { FinalSegment, PartialSegment } from '../stores/transcriptionStore';

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

function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 세그먼트가 추가되면 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments.length, partial?.text]);

  // 마이크 비활성 상태
  if (micPermission === 'denied' || micPermission === 'unsupported') {
    return (
      <PanelWrapper
        title="노트 전용 모드"
        meetingId={meetingId}
        statusLabel="마이크 비활성"
        statusClassName="bg-slate-100 text-slate-600"
      >
        <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted">
          <div>
            <MicOff className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p>마이크 접근이 차단되어 전사가 비활성화되었습니다.</p>
            <p className="mt-1 text-xs">노트 작성에 집중해주세요.</p>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  // 배치 모드
  if (!isRealtimeMode) {
    return (
      <PanelWrapper
        title="배치 전사 대기"
        meetingId={meetingId}
        statusLabel="배치 모드"
        statusClassName="bg-slate-100 text-slate-700"
      >
        <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted">
          <div>
            <Mic className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p>현재 배치 전사 모드입니다.</p>
            <p className="mt-1 text-xs">회의 종료 후 수집된 오디오가 AWS 배치 전사로 처리됩니다.</p>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  // 실시간 모드
  const statusLabel = !isConnected
    ? '연결 중...'
    : hasActiveSession
      ? '전사 중'
      : '대기 중';

  const statusClassName = !isConnected
    ? 'bg-amber-100 text-amber-800'
    : hasActiveSession
      ? 'bg-emerald-100 text-emerald-800 animate-pulse'
      : 'bg-slate-100 text-slate-700';

  return (
    <PanelWrapper
      title="실시간 전사"
      meetingId={meetingId}
      statusLabel={statusLabel}
      statusClassName={statusClassName}
      error={error}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
      >
        {segments.length === 0 && !partial && (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            <div className="text-center">
              <Languages className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p>음성을 기다리고 있습니다...</p>
              <p className="mt-1 text-xs">말씀하시면 실시간으로 텍스트가 표시됩니다.</p>
            </div>
          </div>
        )}

        {/* 확정된 세그먼트들 */}
        {segments.map((seg) => (
          <div key={seg.resultId} className="group">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                {formatSegmentTime(seg.startTime)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{seg.text}</p>
                {seg.translatedText && (
                  <p className="mt-0.5 text-sm leading-relaxed text-blue-600">
                    <Languages className="mr-1 inline-block h-3 w-3" />
                    {seg.translatedText}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 진행중 partial */}
        {partial && (
          <div className="group opacity-70">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-mono text-amber-700">
                {formatSegmentTime(partial.startTime)}
              </span>
              <p className="min-w-0 flex-1 text-sm italic leading-relaxed text-slate-500">
                {partial.text}
              </p>
            </div>
          </div>
        )}
      </div>
    </PanelWrapper>
  );
}

/** 전사 패널 래퍼 (헤더 + 본문) */
function PanelWrapper({
  title,
  meetingId,
  statusLabel,
  statusClassName,
  error,
  children,
}: {
  title: string;
  meetingId: string;
  statusLabel: string;
  statusClassName: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">TRANSCRIPTION</p>
            <h2 className="mt-1 text-sm font-semibold">{title}</h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>
        <div className="mt-2 text-[10px] text-muted">
          Meeting ID: {meetingId.slice(0, 8)}...
        </div>
        {error && (
          <div className="mt-1.5 rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
            {error}
          </div>
        )}
      </div>
      <div className="flex h-[calc(100%-84px)] flex-col">
        {children}
      </div>
    </>
  );
}