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
    isLoading,
    error,
    fetchMeetings,
    searchMeetings,
    deleteMeeting,
  } = useMeetingStore();

  return {
    meetings,
    isLoading,
    error,
    fetchMeetings,
    searchMeetings,
    deleteMeeting,
  };
}
