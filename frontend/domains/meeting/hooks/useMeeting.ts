import { useMeetingStore } from '../stores/meetingStore';

export function useMeeting() {
  const {
    currentMeeting,
    isRecording,
    elapsedTime,
    isLoading,
    error,
    startMeeting,
    endMeeting,
    updatePrompt,
    setCurrentMeeting,
  } = useMeetingStore();

  return {
    currentMeeting,
    isRecording,
    elapsedTime,
    isLoading,
    error,
    startMeeting,
    endMeeting,
    updatePrompt,
    setCurrentMeeting,
  };
}

export function useMeetings() {
  const {
    meetings,
    trashMeetings,
    isLoading,
    error,
    fetchMeetings,
    fetchTrashMeetings,
    searchMeetings,
    deleteMeeting,
    restoreMeeting,
    purgeMeeting,
    bulkDeleteMeetings,
    bulkRestoreMeetings,
    bulkPurgeMeetings,
    applyMeetingStatusUpdate,
  } = useMeetingStore();

  return {
    meetings,
    trashMeetings,
    isLoading,
    error,
    fetchMeetings,
    fetchTrashMeetings,
    searchMeetings,
    deleteMeeting,
    restoreMeeting,
    purgeMeeting,
    bulkDeleteMeetings,
    bulkRestoreMeetings,
    bulkPurgeMeetings,
    applyMeetingStatusUpdate,
  };
}
