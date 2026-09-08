import type { ReactNode } from 'react';

interface TranscriptPanelFrameProps {
  title: string;
  /** 유지: 호출부 호환용 (표시하지 않음) */
  meetingId?: string;
  statusLabel: string;
  statusClassName: string;
  error?: string | null;
  children: ReactNode;
}

export function TranscriptPanelFrame({
  title,
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
            <h2 className="text-sm text-[var(--ink-strong)]">{title}</h2>
          </div>
          <span
            className={`status-pill ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>
        {error ? (
          <div className="mt-2 rounded-[6px] bg-scorch/15 px-2 py-1 text-xs text-danger">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  );
}
