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
      <div className="border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="tag-dot">Live transcription</p>
            <h2 className="mt-1 text-sm text-[var(--ink-strong)]">{title}</h2>
          </div>
          <span
            className={`status-pill !text-[10px] ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="data-mono mt-2 text-[10px] text-[var(--ink-faint)]">
          id · {meetingId.slice(0, 8)}
        </div>
        {error ? (
          <div className="data-mono mt-1.5 rounded-[4px] bg-scorch/15 px-2 py-1 text-[10px] text-danger">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex h-[calc(100%-84px)] flex-col">{children}</div>
    </>
  );
}
