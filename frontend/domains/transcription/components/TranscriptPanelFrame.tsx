import type { ReactNode } from 'react';

interface TranscriptPanelFrameProps {
  title: string;
  meetingId: string;
  statusLabel: string;
  statusClassName: string;
  error?: string | null;
  children: ReactNode;
}

export function TranscriptPanelFrame({
  title,
  meetingId,
  statusLabel,
  statusClassName,
  error,
  children,
}: TranscriptPanelFrameProps) {
  return (
    <>
      <div className="border-b border-white/[0.06] bg-black/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-sm !text-seafoam">Live transcription</p>
            <h2 className="mt-1 text-sm font-medium !text-white">{title}</h2>
          </div>
          <span
            className={`status-pill !text-[10px] ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="data-mono mt-2 text-[10px] text-white/40">
          id · {meetingId.slice(0, 8)}
        </div>
        {error ? (
          <div className="data-mono mt-1.5 rounded-[4px] bg-[#f08b80]/15 px-2 py-1 text-[10px] text-[#f08b80]">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex h-[calc(100%-84px)] flex-col">{children}</div>
    </>
  );
}
