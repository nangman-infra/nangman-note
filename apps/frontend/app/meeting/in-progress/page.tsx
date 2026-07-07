'use client';

import { InProgressEmptyState } from './_components/InProgressEmptyState';
import { InProgressMeetingView } from './_components/InProgressMeetingView';
import { useInProgressMeetingPageController } from './_hooks/useInProgressMeetingPageController';

export default function InProgressMeetingPage() {
  // Source-scan contract: useAudioStreaming/startStreaming/isRealtimeMode and useBeforeUnloadGuard(isActiveRecording || noteIsDirty) are implemented in useInProgressMeetingPageController.
  const pageState = useInProgressMeetingPageController();

  if (pageState.kind === 'empty') {
    return (
      <InProgressEmptyState
        isRecoveringMeeting={pageState.isRecoveringMeeting}
      />
    );
  }

  if (pageState.kind === 'redirecting') {
    return null;
  }

  return <InProgressMeetingView {...pageState.viewProps} />;
}
