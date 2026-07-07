'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import {
  type Meeting,
  MeetingStatus,
  MeetingTranscriptionMode,
  meetingApi,
  useBeforeUnloadGuard,
  useMeeting,
} from '@/domains/meeting';
import { useNoteStore } from '@/domains/note';
import {
  type AudioCapturePermission,
  type AudioDevice,
  type AudioStreamingState,
  type RecorderState,
  useAudioCapture,
  useAudioStreaming,
  useAudioUpload,
  type UploadState,
  useMediaRecorder,
  useTranscription,
} from '@/domains/transcription';
import type { InProgressWorkspace } from '../_components/InProgressWorkspace';
import {
  buildInProgressBanners,
  getConnectionBadge,
  getRecordingBadge,
  type InProgressBannerItem,
  type MeetingStatusBadge,
} from '../_components/meetingStatusView';
import { useInProgressEndMeetingFlow } from './useInProgressEndMeetingFlow';

type WorkspaceProps = React.ComponentProps<typeof InProgressWorkspace>;

type MobilePanel = 'note' | 'transcript';

export interface InProgressMeetingViewProps {
  meeting: Meeting;
  permission: AudioCapturePermission;
  devices: AudioDevice[];
  selectedDeviceId: string;
  recordingBadge: MeetingStatusBadge;
  connectionBadge: MeetingStatusBadge;
  micBannerDismissed: boolean;
  elapsedSeconds: number;
  isLoading: boolean;
  isEnding: boolean;
  banners: InProgressBannerItem[];
  mobilePanel: MobilePanel;
  segments: WorkspaceProps['segments'];
  partial: WorkspaceProps['partial'];
  isConnected: boolean;
  hasActiveSession: boolean;
  isRealtimeMode: boolean;
  transcriptionError: string | null;
  audioStreamingError: string | null;
  stream: MediaStream | null;
  recorderState: RecorderState;
  audioStreamingState: AudioStreamingState;
  showProcessing: boolean;
  meetingId: string;
  uploadState: UploadState;
  uploadProgress: number;
  uploadError: string | null;
  showEndDialog: boolean;
  recordingTimeSeconds: number;
  noteLength: number;
  onGoHome: () => void;
  onDeviceChange: (deviceId: string) => void;
  onEndClick: () => void;
  onMobilePanelChange: (panel: MobilePanel) => void;
  onProcessingComplete: () => void;
  onProcessingGoHome: () => void;
  onShowSummaryInfo: () => void;
  onSaveNote: () => Promise<void>;
  onEndConfirm: () => void | Promise<void>;
  onEndCancel: () => void;
}

export type InProgressMeetingPageState =
  | { kind: 'empty'; isRecoveringMeeting: boolean }
  | { kind: 'redirecting' }
  | { kind: 'ready'; viewProps: InProgressMeetingViewProps };

export function useInProgressMeetingPageController(): InProgressMeetingPageState {
  const router = useRouter();
  const { pushToast, pushUndoToast } = useFeedback();
  const { currentMeeting, isLoading, error, endMeeting, setCurrentMeeting } =
    useMeeting();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRecoveringMeeting, setIsRecoveringMeeting] = useState(false);
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const [meetingIdFromQuery, setMeetingIdFromQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('note');
  const [micBannerDismissed, setMicBannerDismissed] = useState(false);
  const [wasFallenBack, setWasFallenBack] = useState(false);
  const fallbackHandledRef = useRef(false);

  const navigateHome = useCallback(() => {
    setIsLeavingPage(true);
    router.replace('/');
  }, [router]);

  const {
    permission,
    error: audioCaptureError,
    devices,
    selectedDeviceId,
    stream,
    requestPermission,
    selectDevice,
    stopCapture,
  } = useAudioCapture();
  const {
    state: recorderState,
    chunkCount,
    error: recorderError,
    startRecording,
    stopRecording,
    cleanupChunks,
  } = useMediaRecorder();
  const {
    uploadState,
    progress: uploadProgress,
    error: uploadError,
    upload: uploadAudio,
    reset: resetUpload,
  } = useAudioUpload();
  const {
    state: audioStreamingState,
    error: audioStreamingError,
    startStreaming,
    stopStreaming,
  } = useAudioStreaming();

  const meetingId = currentMeeting?.id || meetingIdFromQuery;
  const transcriptionMode =
    currentMeeting?.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
  const isRealtimeMode =
    transcriptionMode === MeetingTranscriptionMode.REALTIME;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMeetingIdFromQuery(params.get('meetingId')?.trim() ?? '');
  }, []);

  const handleRealtimeFallbackToBatch = useCallback(
    (payload?: { reason?: string }) => {
      if (fallbackHandledRef.current) return;
      fallbackHandledRef.current = true;

      setWasFallenBack(true);
      stopStreaming();
      if (currentMeeting) {
        setCurrentMeeting({
          ...currentMeeting,
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        });
        void meetingApi
          .updateTranscriptionMode(
            currentMeeting.id,
            MeetingTranscriptionMode.BATCH,
          )
          .then((updatedMeeting) => {
            setCurrentMeeting(updatedMeeting);
          })
          .catch(() => {
            // 로컬 모드만 batch로 유지하고 종료 플로우를 계속 진행한다.
          });
      }

      pushToast({
        title: '실시간 전사가 배치 모드로 전환되었습니다',
        description: getRealtimeFallbackDescription(payload?.reason),
        variant: 'info',
      });
    },
    [currentMeeting, pushToast, setCurrentMeeting, stopStreaming],
  );

  const {
    segments,
    partial,
    isConnected,
    hasActiveSession,
    error: transcriptionError,
    stopSession: stopTranscriptionSession,
    socketRef: transcriptionSocketRef,
  } = useTranscription(meetingId, isRealtimeMode, {
    onFallbackToBatch: handleRealtimeFallbackToBatch,
  });
  const {
    showEndDialog,
    setShowEndDialog,
    isEnding,
    handleEndConfirm,
  } = useInProgressEndMeetingFlow({
    meetingId,
    transcriptionMode,
    isRealtimeMode,
    recorderState,
    error,
    endMeeting,
    stopCapture,
    stopStreaming,
    stopTranscriptionSession,
    stopRecording,
    uploadAudio,
    cleanupChunks,
    pushToast,
    pushUndoToast,
    setCurrentMeeting,
    setMeetingIdFromQuery,
    setShowProcessing,
    navigateHome,
  });

  useEffect(() => {
    fallbackHandledRef.current = false;
  }, [meetingId]);

  const isActiveRecording =
    recorderState === 'recording' ||
    recorderState === 'stopping' ||
    (isRealtimeMode &&
      (audioStreamingState === 'streaming' || audioStreamingState === 'stopping'));
  const noteIsDirty = useNoteStore((s) => s.isDirty);
  useBeforeUnloadGuard(isActiveRecording || noteIsDirty);

  useEffect(() => {
    if (!currentMeeting?.startedAt) return;
    const timerId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [currentMeeting?.startedAt]);

  useEffect(() => {
    if (currentMeeting && currentMeeting.status !== MeetingStatus.RECORDING && !showProcessing) {
      setCurrentMeeting(null);
      navigateHome();
    }
  }, [currentMeeting, showProcessing, setCurrentMeeting, navigateHome]);

  useEffect(() => {
    if (currentMeeting || !meetingIdFromQuery) return;

    let disposed = false;
    const recoverMeeting = async () => {
      setIsRecoveringMeeting(true);
      try {
        const meeting = await meetingApi.get(meetingIdFromQuery);
        if (disposed) return;
        if (meeting.status !== MeetingStatus.RECORDING) {
          pushToast({
            title: '이미 종료된 회의입니다',
            description: '회의 결과 화면에서 회의록을 확인해주세요.',
            variant: 'info',
          });
          navigateHome();
          return;
        }
        setCurrentMeeting(meeting);
      } catch {
        if (disposed) return;
        pushToast({
          title: '진행 중 회의를 복구하지 못했습니다',
          description: '회의가 이미 종료되었거나 접근할 수 없습니다.',
          variant: 'info',
        });
        navigateHome();
      } finally {
        if (!disposed) {
          setIsRecoveringMeeting(false);
        }
      }
    };

    void recoverMeeting();
    return () => {
      disposed = true;
    };
  }, [
    currentMeeting,
    meetingIdFromQuery,
    navigateHome,
    pushToast,
    setCurrentMeeting,
  ]);

  const elapsedSeconds = currentMeeting?.startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(currentMeeting.startedAt).getTime()) / 1000))
    : 0;

  useEffect(() => {
    if (!meetingId || permission !== 'prompt') return;

    const init = async () => {
      const captureResult = await requestPermission();
      if (!captureResult.granted && captureResult.reason === 'denied') {
        pushToast({
          title: '마이크 접근이 차단되었습니다',
          description: '노트 전용 모드로 계속합니다. 전사 없이 노트 기반으로 결과를 생성합니다.',
          variant: 'info',
        });
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    if (!stream || !meetingId) return;
    if (isEnding) return;

    if (isRealtimeMode) {
      if (
        (audioStreamingState === 'idle' || audioStreamingState === 'stopped') &&
        isConnected &&
        transcriptionSocketRef.current?.connected
      ) {
        void startStreaming(stream, transcriptionSocketRef.current, {
          onFallbackToBatch: handleRealtimeFallbackToBatch,
        });
      }
    } else if (recorderState === 'idle') {
      startRecording(stream, meetingId);
    }
  }, [
    stream,
    meetingId,
    isEnding,
    isRealtimeMode,
    isConnected,
    recorderState,
    audioStreamingState,
    startRecording,
    startStreaming,
    transcriptionSocketRef,
    handleRealtimeFallbackToBatch,
  ]);

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      selectDevice(deviceId);

      if (isRealtimeMode) {
        stopStreaming();
      } else if (recorderState === 'recording' || recorderState === 'stopping') {
        await stopRecording();
      }

      await requestPermission({ deviceId });
    },
    [
      selectDevice,
      isRealtimeMode,
      stopStreaming,
      recorderState,
      stopRecording,
      requestPermission,
    ],
  );

  const handleProcessingComplete = () => {
    setShowProcessing(false);
    resetUpload();
    pushToast({
      title: '회의록이 준비되었습니다',
      description: '결과 화면에서 확인하세요.',
      variant: 'success',
    });
    setMeetingIdFromQuery('');
    setCurrentMeeting(null);
    navigateHome();
  };

  const handleGoHome = useCallback(() => {
    if (currentMeeting?.status === MeetingStatus.RECORDING && !showProcessing) {
      pushToast({
        title: '회의가 아직 진행 중입니다',
        description: '회의를 종료한 뒤 목록으로 이동해주세요.',
        variant: 'info',
      });
      setShowEndDialog(true);
      return;
    }

    navigateHome();
  }, [
    currentMeeting?.status,
    pushToast,
    navigateHome,
    showProcessing,
    setShowEndDialog,
  ]);

  const handleProcessingGoHome = () => {
    setShowProcessing(false);
    setMeetingIdFromQuery('');
    setCurrentMeeting(null);
    navigateHome();
  };

  const handleShowSummaryInfo = () => {
    pushToast({
      title: 'AI 요약은 회의 종료 후에 생성됩니다',
      description: '회의를 종료하면 전사·노트 기반으로 요약이 자동 생성됩니다.',
      variant: 'info',
    });
  };

  const handleSaveNote = async () => {
    if (!meetingId) return;
    const ok = await useNoteStore.getState().saveNote(meetingId);
    const toastCopy = getSaveNoteToastCopy(ok);
    pushToast({
      title: toastCopy.title,
      description: toastCopy.description,
      variant: toastCopy.variant,
    });
  };

  if (!currentMeeting) {
    if (isLeavingPage) {
      return { kind: 'redirecting' };
    }

    return { kind: 'empty', isRecoveringMeeting };
  }

  if (currentMeeting.status !== MeetingStatus.RECORDING && !showProcessing) {
    return { kind: 'redirecting' };
  }

  const banners = buildInProgressBanners({
    meetingError: error,
    permission,
    recorderError,
    micBannerDismissed,
    audioCaptureError,
    isRealtimeMode,
    transcriptionError,
    audioStreamingError,
    onDismissMicBanner: () => setMicBannerDismissed(true),
  });

  return {
    kind: 'ready',
    viewProps: {
      meeting: currentMeeting,
      permission,
      devices,
      selectedDeviceId: selectedDeviceId || '',
      recordingBadge: getRecordingBadge(permission, recorderState, chunkCount),
      connectionBadge: getConnectionBadge({
        meetingId,
        permission,
        wasFallenBack,
        isRealtimeMode,
        isConnected,
        hasActiveSession,
      }),
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
      recordingTimeSeconds: elapsedSeconds,
      noteLength: useNoteStore.getState().noteContent.length,
      onGoHome: handleGoHome,
      onDeviceChange: handleDeviceChange,
      onEndClick: () => setShowEndDialog(true),
      onMobilePanelChange: setMobilePanel,
      onProcessingComplete: handleProcessingComplete,
      onProcessingGoHome: handleProcessingGoHome,
      onShowSummaryInfo: handleShowSummaryInfo,
      onSaveNote: handleSaveNote,
      onEndConfirm: handleEndConfirm,
      onEndCancel: () => setShowEndDialog(false),
    },
  };
}

function getRealtimeFallbackDescription(reason?: string): string {
  if (reason === 'realtime-capacity-exceeded') {
    return '동시 사용량이 높아 배치 전사로 자동 전환했습니다.';
  }

  if (reason?.startsWith('client-')) {
    return '실시간 연결이 불안정해 남은 구간을 배치 전사로 전환했습니다.';
  }

  return '전사 안정성을 위해 배치 모드로 전환했습니다.';
}

function getSaveNoteToastCopy(ok: boolean): {
  title: string;
  description: string;
  variant: 'success' | 'error';
} {
  if (ok) {
    return {
      title: '노트를 저장했습니다',
      description: '최신 내용이 안전하게 저장되었습니다.',
      variant: 'success',
    };
  }

  return {
    title: '노트 저장에 실패했습니다',
    description: '오프라인 백업에 저장했으며, 연결이 복구되면 다시 시도합니다.',
    variant: 'error',
  };
}
