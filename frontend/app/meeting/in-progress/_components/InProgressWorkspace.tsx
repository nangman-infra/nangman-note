'use client';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { NoteEditor } from '@/domains/note';
import {
  TranscriptAudioVisualizer,
  TranscriptPanel,
  type AudioCapturePermission,
  type AudioStreamingState,
} from '@/domains/transcription';

type TranscriptPanelProps = React.ComponentProps<typeof TranscriptPanel>;

interface InProgressWorkspaceProps {
  meetingId: string;
  mobilePanel: 'note' | 'transcript';
  onMobilePanelChange: (panel: 'note' | 'transcript') => void;
  segments: TranscriptPanelProps['segments'];
  partial: TranscriptPanelProps['partial'];
  isConnected: boolean;
  hasActiveSession: boolean;
  isRealtimeMode: boolean;
  permission: AudioCapturePermission;
  transcriptionError: string | null;
  audioStreamingError: string | null;
  stream: MediaStream | null;
  recorderState: string;
  audioStreamingState: AudioStreamingState;
}

export function InProgressWorkspace({
  meetingId,
  mobilePanel,
  onMobilePanelChange,
  segments,
  partial,
  isConnected,
  hasActiveSession,
  isRealtimeMode,
  permission,
  transcriptionError,
  audioStreamingError,
  stream,
  recorderState,
  audioStreamingState,
}: InProgressWorkspaceProps) {
  return (
    <>
      <main className="flex-1 flex overflow-hidden">
        <section className={`hidden w-2/5 flex-col border-r border-[var(--line-soft)] bg-[var(--surface-container-low)] lg:flex ${mobilePanel === 'transcript' ? '!flex w-full' : ''}`}>
          <ErrorBoundary>
            <div className="flex min-h-0 flex-1 flex-col">
              <TranscriptPanel
                segments={segments}
                partial={partial}
                isConnected={isConnected}
                hasActiveSession={hasActiveSession}
                isRealtimeMode={isRealtimeMode}
                micPermission={permission}
                meetingId={meetingId}
                error={transcriptionError || audioStreamingError}
              />
            </div>
          </ErrorBoundary>
          <TranscriptAudioVisualizer
            stream={stream}
            isActive={
              recorderState === 'recording' ||
              audioStreamingState === 'streaming'
            }
          />
        </section>

        <section className={`flex-1 flex-col editor-dot-grid hidden lg:flex ${mobilePanel === 'note' ? '!flex' : ''}`}>
          <ErrorBoundary>
            <NoteEditor meetingId={meetingId} />
          </ErrorBoundary>
        </section>
      </main>

      <div className="flex gap-1 border-t border-[var(--line-soft)] bg-[var(--surface-container-low)] p-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => onMobilePanelChange('note')}
          className={`flex-1 rounded-[6px] px-3 py-2 text-xs transition-colors ${
            mobilePanel === 'note'
              ? 'bg-[var(--surface-container-high)] text-white'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
          }`}
        >
          노트
        </button>
        <button
          type="button"
          onClick={() => onMobilePanelChange('transcript')}
          className={`flex-1 rounded-[6px] px-3 py-2 text-xs transition-colors ${
            mobilePanel === 'transcript'
              ? 'bg-[var(--surface-container-high)] text-white'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
          }`}
        >
          전사
        </button>
      </div>
    </>
  );
}
