'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { meetingApi } from '@/domains/meeting/api/meetingApi';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { useBeforeUnloadGuard } from '@/domains/meeting/hooks/useBeforeUnloadGuard';
import { EndMeetingDialog } from '@/domains/meeting/components/EndMeetingDialog';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { MeetingStatus } from '@/domains/meeting/types/meeting.types';
import { useTranscription } from '@/domains/transcription/hooks/useTranscription';
import { useAudioStreaming } from '@/domains/transcription/hooks/useAudioStreaming';
import { useNoteStore } from '@/domains/note/stores/noteStore';
import { useAudioCapture } from '@/domains/transcription/hooks/useAudioCapture';
import { useMediaRecorder } from '@/domains/transcription/hooks/useMediaRecorder';
import { useAudioUpload } from '@/domains/transcription/hooks/useAudioUpload';
import { formatTime } from '@/lib/utils/date';
import { InProgressBanners } from './_components/InProgressBanners';
import { InProgressEmptyState } from './_components/InProgressEmptyState';
import { InProgressHeader } from './_components/InProgressHeader';
import { InProgressProcessingPanel } from './_components/InProgressProcessingPanel';
import { InProgressQuickActions } from './_components/InProgressQuickActions';
import { InProgressWorkspace } from './_components/InProgressWorkspace';
import {
  buildInProgressBanners,
  getConnectionBadge,
  getRecordingBadge,
} from './_components/meetingStatusView';
import { useInProgressEndMeetingFlow } from './_hooks/useInProgressEndMeetingFlow';

export default function InProgressMeetingPage() {
  const router = useRouter();
  const { pushToast, pushUndoToast } = useFeedback();
  const { currentMeeting, isLoading, error, endMeeting, setCurrentMeeting } =
    useMeeting();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRecoveringMeeting, setIsRecoveringMeeting] = useState(false);
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const [meetingIdFromQuery, setMeetingIdFromQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'note' | 'transcript'>('note');
  const [micBannerDismissed, setMicBannerDismissed] = useState(false);
  const [wasFallenBack, setWasFallenBack] = useState(false);
  const fallbackHandledRef = useRef(false);

  const navigateHome = useCallback(() => {
    setIsLeavingPage(true);
    router.replace('/');
  }, [router]);

  // 오디오 캡처 (마이크 권한 + 디바이스 선택)
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

  // 녹음 (MediaRecorder + IndexedDB 청크)
  const {
    state: recorderState,
    chunkCount,
    error: recorderError,
    startRecording,
    stopRecording,
    cleanupChunks,
  } = useMediaRecorder();

  // S3 업로드
  const {
    uploadState,
    progress: uploadProgress,
    error: uploadError,
    upload: uploadAudio,
    reset: resetUpload,
  } = useAudioUpload();

  // 실시간 오디오 스트리밍
  const {
    state: audioStreamingState,
    error: audioStreamingError,
    startStreaming,
    stopStreaming,
  } = useAudioStreaming();

  const meetingId = currentMeeting?.id || meetingIdFromQuery;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMeetingIdFromQuery(params.get('meetingId')?.trim() ?? '');
  }, []);
  const transcriptionMode =
    currentMeeting?.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
  const isRealtimeMode =
    transcriptionMode === MeetingTranscriptionMode.REALTIME;
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
        description:
          payload?.reason === 'realtime-capacity-exceeded'
            ? '동시 사용량이 높아 배치 전사로 자동 전환했습니다.'
            : payload?.reason?.startsWith('client-')
              ? '실시간 연결이 불안정해 남은 구간을 배치 전사로 전환했습니다.'
            : '전사 안정성을 위해 배치 모드로 전환했습니다.',
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

  // 탭 닫기 방지: 배치 녹음 또는 실시간 스트리밍이 활성일 때, 또는 미저장 노트가 있을 때
  const isActiveRecording =
    recorderState === 'recording' ||
    recorderState === 'stopping' ||
    (isRealtimeMode &&
      (audioStreamingState === 'streaming' || audioStreamingState === 'stopping'));
  const noteIsDirty = useNoteStore((s) => s.isDirty);
  useBeforeUnloadGuard(isActiveRecording || noteIsDirty);

  // 타이머
  useEffect(() => {
    if (!currentMeeting?.startedAt) return;
    const timerId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [currentMeeting?.startedAt]);

  // 이미 종료된 회의면 자동으로 홈으로 이동
  useEffect(() => {
    if (currentMeeting && currentMeeting.status !== MeetingStatus.RECORDING && !showProcessing) {
      setCurrentMeeting(null);
      navigateHome();
    }
  }, [currentMeeting, showProcessing, setCurrentMeeting, navigateHome]);

  // 새로고침/재접속 복구: URL의 meetingId로 회의 상태 복원
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

  // 회의 시작 시 마이크 권한 요청 + 녹음 시작
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

  // 마이크 스트림 획득 후 녹음 시작 (배치) 또는 스트리밍 시작 (실시간)
  // isConnected도 의존성에 포함하여 소켓 연결 완료 시에도 트리거됨
  useEffect(() => {
    if (!stream || !meetingId) return;
    if (isEnding) return;

    if (isRealtimeMode) {
      // 실시간 모드: AudioWorklet PCM 스트리밍
      // 초기 진입(idle)과 디바이스 재선택 후(stopped) 모두 재시작 가능해야 한다.
      if (
        (audioStreamingState === 'idle' || audioStreamingState === 'stopped') &&
        isConnected &&
        transcriptionSocketRef.current?.connected
      ) {
        void startStreaming(stream, transcriptionSocketRef.current, {
          onFallbackToBatch: handleRealtimeFallbackToBatch,
        });
      }
    } else {
      // 배치 모드: MediaRecorder 녹음
      if (recorderState === 'idle') {
        startRecording(stream, meetingId);
      }
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

  // 마이크 디바이스 변경 핸들러
  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      selectDevice(deviceId);

      // 디바이스 변경 후 재연결: 현재 모드별 캡처를 먼저 정리한다.
      if (isRealtimeMode) {
        stopStreaming();
      } else if (recorderState === 'recording' || recorderState === 'stopping') {
        await stopRecording();
      }

      const captureResult = await requestPermission({ deviceId });
      if (captureResult.granted) {
        // stream이 변경되면 위 useEffect에서 자동 재시작
      }
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

  const connectionBadge = getConnectionBadge({
    meetingId,
    permission,
    wasFallenBack,
    isRealtimeMode,
    isConnected,
    hasActiveSession,
  });
  const recBadge = getRecordingBadge(permission, recorderState, chunkCount);

  // 처리 완료 시 홈으로 이동
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

  // ── 빈 상태 / 복구 화면 ──

  // 회의 없음 상태
  if (!currentMeeting) {
    if (isLeavingPage) {
      return null;
    }

    return <InProgressEmptyState isRecoveringMeeting={isRecoveringMeeting} />;
  }

  if (currentMeeting.status !== MeetingStatus.RECORDING && !showProcessing) {
    return null; // 홈으로 리다이렉트 중
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <InProgressHeader
        meetingTitle={currentMeeting.title || '제목 없는 회의'}
        permission={permission}
        devices={devices}
        selectedDeviceId={selectedDeviceId || ''}
        recordingBadge={recBadge}
        connectionBadge={connectionBadge}
        micBannerDismissed={micBannerDismissed}
        elapsedSeconds={elapsedSeconds}
        isLoading={isLoading}
        isEnding={isEnding}
        onGoHome={handleGoHome}
        onDeviceChange={(deviceId) => void handleDeviceChange(deviceId)}
        onEndClick={() => setShowEndDialog(true)}
      />

      {/* 상태 배너들 — 헤더 바로 아래, 메인 위 */}
      <InProgressBanners banners={banners} />

      <InProgressWorkspace
        meetingId={currentMeeting.id}
        mobilePanel={mobilePanel}
        onMobilePanelChange={setMobilePanel}
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

      {/* 처리 진행 상태 (회의 종료 후) — 비차단: 홈 이동 허용 */}
      {showProcessing && meetingId && (
        <InProgressProcessingPanel
          meetingId={meetingId}
          uploadState={uploadState}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          onComplete={handleProcessingComplete}
          onGoHome={() => {
            setShowProcessing(false);
            setMeetingIdFromQuery('');
            setCurrentMeeting(null);
            navigateHome();
          }}
        />
      )}

      {/* 우하단 Floating Quick Actions (FAB) — 회의 진행 중 유용한 액션 */}
      <InProgressQuickActions
        onShowSummaryInfo={() => {
          pushToast({
            title: 'AI 요약은 회의 종료 후에 생성됩니다',
            description:
              '회의를 종료하면 전사·노트 기반으로 요약이 자동 생성됩니다.',
            variant: 'info',
          });
        }}
        onSaveNote={async () => {
          if (!meetingId) return;
          const ok = await useNoteStore.getState().saveNote(meetingId);
          pushToast({
            title: ok ? '노트를 저장했습니다' : '노트 저장에 실패했습니다',
            description: ok
              ? '최신 내용이 안전하게 저장되었습니다.'
              : '오프라인 백업에 저장했으며, 연결이 복구되면 다시 시도합니다.',
            variant: ok ? 'success' : 'error',
          });
        }}
      />

      {/* 종료 확인 모달 */}
      <EndMeetingDialog
        open={showEndDialog}
        isLoading={isEnding}
        recordingTime={formatTime(elapsedSeconds)}
        noteLength={useNoteStore.getState().noteContent.length}
        onConfirm={handleEndConfirm}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
