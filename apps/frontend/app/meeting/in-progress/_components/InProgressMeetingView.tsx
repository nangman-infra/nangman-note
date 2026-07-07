'use client';

import {
  EndMeetingDialog,
} from '@/domains/meeting';
import { formatTime } from '@/lib/utils/date';
import { InProgressBanners } from './InProgressBanners';
import { InProgressHeader } from './InProgressHeader';
import { InProgressProcessingPanel } from './InProgressProcessingPanel';
import { InProgressQuickActions } from './InProgressQuickActions';
import { InProgressWorkspace } from './InProgressWorkspace';
import type { InProgressMeetingViewProps } from '../_hooks/useInProgressMeetingPageController';

export function InProgressMeetingView({
  meeting,
  permission,
  devices,
  selectedDeviceId,
  recordingBadge,
  connectionBadge,
  micBannerDismissed,
  elapsedSeconds,
  isLoading,
  isEnding,
  banners,
  mobilePanel,
  segments,
  partial,
  isConnected,
  hasActiveSession,
  isRealtimeMode,
  transcriptionError,
  audioStreamingError,
  stream,
  recorderState,
  audioStreamingState,
  showProcessing,
  meetingId,
  uploadState,
  uploadProgress,
  uploadError,
  showEndDialog,
  recordingTimeSeconds,
  noteLength,
  onGoHome,
  onDeviceChange,
  onEndClick,
  onMobilePanelChange,
  onProcessingComplete,
  onProcessingGoHome,
  onShowSummaryInfo,
  onSaveNote,
  onEndConfirm,
  onEndCancel,
}: InProgressMeetingViewProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <InProgressHeader
        meetingTitle={meeting.title || '제목 없는 회의'}
        permission={permission}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        recordingBadge={recordingBadge}
        connectionBadge={connectionBadge}
        micBannerDismissed={micBannerDismissed}
        elapsedSeconds={elapsedSeconds}
        isLoading={isLoading}
        isEnding={isEnding}
        onGoHome={onGoHome}
        onDeviceChange={(deviceId) => void onDeviceChange(deviceId)}
        onEndClick={onEndClick}
      />

      <InProgressBanners banners={banners} />

      <InProgressWorkspace
        meetingId={meeting.id}
        mobilePanel={mobilePanel}
        onMobilePanelChange={onMobilePanelChange}
        segments={segments}
        partial={partial}
        isConnected={isConnected}
        hasActiveSession={hasActiveSession}
        isRealtimeMode={isRealtimeMode}
        permission={permission}
        transcriptionError={transcriptionError}
        audioStreamingError={audioStreamingError}
        stream={stream}
        recorderState={recorderState}
        audioStreamingState={audioStreamingState}
      />

      {showProcessing && meetingId && (
        <InProgressProcessingPanel
          meetingId={meetingId}
          uploadState={uploadState}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          onComplete={onProcessingComplete}
          onGoHome={onProcessingGoHome}
        />
      )}

      <InProgressQuickActions
        onShowSummaryInfo={onShowSummaryInfo}
        onSaveNote={onSaveNote}
      />

      <EndMeetingDialog
        open={showEndDialog}
        isLoading={isEnding}
        recordingTime={formatTime(recordingTimeSeconds)}
        noteLength={noteLength}
        onConfirm={onEndConfirm}
        onCancel={onEndCancel}
      />
    </div>
  );
}
