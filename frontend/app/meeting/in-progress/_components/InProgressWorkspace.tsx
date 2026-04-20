'use client';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { NoteEditor } from '@/domains/note/components/NoteEditor';
import { TranscriptAudioVisualizer } from '@/domains/transcription/components/TranscriptAudioVisualizer';
import { TranscriptPanel } from '@/domains/transcription/components/TranscriptPanel';
import type { AudioCapturePermission } from '@/domains/transcription/hooks/useAudioCapture';
import type { AudioStreamingState } from '@/domains/transcription/hooks/useAudioStreaming';

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
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 rounded-none bg-slate-100 p-1 lg:hidden" style={{ position: 'relative' }}>
          {/* We use a wrapper to keep mobile tabs inside the flow without absolute positioning issues */}
        </div>

        <section className={`w-2/5 flex-col bg-slate-900 text-slate-100 border-r border-[var(--outline-variant)]/10 hidden lg:flex ${mobilePanel === 'transcript' ? '!flex w-full' : ''}`}>
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

      <div className="flex gap-1 bg-slate-100 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => onMobilePanelChange('note')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mobilePanel === 'note'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          노트
        </button>
        <button
          type="button"
          onClick={() => onMobilePanelChange('transcript')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mobilePanel === 'transcript'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          전사
        </button>
      </div>
    </>
  );
}
