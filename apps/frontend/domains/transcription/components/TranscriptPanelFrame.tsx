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
      <div className="bg-slate-950/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400">
              TRANSCRIPTION
            </p>
            <h2 className="mt-1 text-sm font-semibold text-slate-100">{title}</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-400">
          Meeting ID: {meetingId.slice(0, 8)}...
        </div>
        {error ? (
          <div className="mt-1.5 rounded bg-rose-500/15 px-2 py-1 text-[10px] text-rose-300">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex h-[calc(100%-84px)] flex-col">{children}</div>
    </>
  );
}
