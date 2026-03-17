'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Mic, MicOff, Radio, Square, Timer } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { meetingApi } from '@/domains/meeting/api/meetingApi';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { useBeforeUnloadGuard } from '@/domains/meeting/hooks/useBeforeUnloadGuard';
import { EndMeetingDialog } from '@/domains/meeting/components/EndMeetingDialog';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { MeetingStatus } from '@/domains/meeting/types/meeting.types';
import { NoteEditor } from '@/domains/note/components/NoteEditor';
import { useTranscription } from '@/domains/transcription/hooks/useTranscription';
import { useAudioStreaming } from '@/domains/transcription/hooks/useAudioStreaming';
import { TranscriptPanel } from '@/domains/transcription/components/TranscriptPanel';
import { useNoteStore } from '@/domains/note/stores/noteStore';
import { useAudioCapture, type AudioCapturePermission } from '@/domains/transcription/hooks/useAudioCapture';
import { useMediaRecorder } from '@/domains/transcription/hooks/useMediaRecorder';
import { useAudioUpload } from '@/domains/transcription/hooks/useAudioUpload';
import { transcriptionApi } from '@/domains/transcription/api/transcriptionApi';
import { ProcessingProgress } from '@/domains/meeting/components/ProcessingProgress';
import { formatTime } from '@/lib/utils/date';

export default function InProgressMeetingPage() {
  const router = useRouter();
  const { pushToast, pushUndoToast } = useFeedback();
  const { currentMeeting, isLoading, error, endMeeting, setCurrentMeeting } =
    useMeeting();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRecoveringMeeting, setIsRecoveringMeeting] = useState(false);
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const [meetingIdFromQuery, setMeetingIdFromQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'note' | 'transcript'>('note');
  const [micBannerDismissed, setMicBannerDismissed] = useState(false);
  const [showExtraBanners, setShowExtraBanners] = useState(false);
  const [wasFallenBack, setWasFallenBack] = useState(false);
  const fallbackHandledRef = useRef(false);
  const undoCancelledRef = useRef(false);

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

  // 연결 상태 배지
  const connectionBadge = !meetingId
    ? { label: '대기', className: 'bg-slate-100 text-slate-700' }
    : permission === 'denied'
      ? { label: '노트 전용', className: 'bg-amber-100 text-amber-800' }
    : wasFallenBack
      ? { label: '배치로 전환됨', className: 'bg-amber-100 text-amber-800' }
    : !isRealtimeMode
      ? { label: '배치 전사 모드', className: 'bg-slate-100 text-slate-700' }
      : isConnected && hasActiveSession
        ? { label: '실시간 전사 중', className: 'bg-emerald-100 text-emerald-800' }
        : isConnected
          ? { label: '실시간 연결됨', className: 'bg-blue-100 text-blue-800' }
          : { label: '실시간 연결중', className: 'bg-amber-100 text-amber-800' };

  // 녹음 상태 배지
  const recordingBadge = (p: AudioCapturePermission) => {
    if (p === 'denied' || p === 'unsupported') {
      return { label: '녹음 비활성', className: 'bg-slate-100 text-slate-600' };
    }
    if (recorderState === 'recording') {
      return { label: `녹음 중 (${chunkCount}청크)`, className: 'bg-rose-100 text-rose-800' };
    }
    return { label: '녹음 대기', className: 'bg-slate-100 text-slate-600' };
  };
  const recBadge = recordingBadge(permission);

  // --- Undo-aware end meeting flow ---

  // Phase 2: Actually call endMeeting API and handle post-processing
  const proceedWithEndMeeting = useCallback(async () => {
    let audioBlob: Blob | null = null;

    // The recording was already stopped in phase 1, but we need the blob
    // We stored it in the ref during phase 1
    audioBlob = pendingAudioBlobRef.current;
    pendingAudioBlobRef.current = null;

    const shouldRunBatchTranscription =
      transcriptionMode === MeetingTranscriptionMode.BATCH &&
      Boolean(audioBlob && audioBlob.size > 0);

    // 2. 백엔드 회의 종료 API 호출
    const success = await endMeeting({
      skipTranscription: !shouldRunBatchTranscription,
    });
    if (!success) {
      setIsEnding(false);
      pushToast({
        title: '회의 종료에 실패했습니다',
        description: error || '녹음은 유지된 상태입니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    stopCapture();
    setIsEnding(false);
    setShowEndDialog(false);

    // 3. 배치 전사 대상이면 S3 업로드 + 배치 잡 트리거
    if (shouldRunBatchTranscription && audioBlob && meetingId) {
      setShowProcessing(true);

      setMeetingIdFromQuery('');
      pushToast({
        title: '회의를 종료했습니다',
        description: '오디오 업로드 및 전사를 시작합니다.',
        variant: 'success',
      });

      // S3 업로드
      const uploadResult = await uploadAudio(meetingId, audioBlob);

      // IndexedDB 청크 정리
      await cleanupChunks();

      if (uploadResult) {
        // 업로드 완료를 서버가 확인한 뒤 배치 전사 잡 생성
        try {
          await transcriptionApi.confirmUpload(meetingId, uploadResult.uploadId);
        } catch {
          await endMeeting({
            skipTranscription: true,
            markAttentionRequired: true,
          });
          setShowProcessing(false);
          pushToast({
            title: '배치 전사 잡 생성에 실패했습니다',
            description: '전사 없이 노트 기반 결과 생성으로 전환했습니다.',
            variant: 'error',
          });
          setMeetingIdFromQuery('');
          setCurrentMeeting(null);
          navigateHome();
        }
      } else {
        await endMeeting({
          skipTranscription: true,
          markAttentionRequired: true,
        });
        setShowProcessing(false);
        pushToast({
          title: '오디오 업로드에 실패했습니다',
          description: '전사 없이 노트 기반 결과 생성으로 전환했습니다.',
          variant: 'info',
        });
        setMeetingIdFromQuery('');
        setCurrentMeeting(null);
        navigateHome();
      }
    } else {
      // 실시간 모드 또는 오디오 없음: 전사 없이 종료
      await cleanupChunks();

      pushToast({
        title: '회의를 종료했습니다',
        description: '노트 기반으로 결과를 생성합니다.',
        variant: 'success',
      });
      setMeetingIdFromQuery('');
      setCurrentMeeting(null);
      navigateHome();
    }
  }, [
    transcriptionMode,
    endMeeting,
    error,
    stopCapture,
    meetingId,
    uploadAudio,
    cleanupChunks,
    pushToast,
    setCurrentMeeting,
    navigateHome,
  ]);

  // Ref to hold the audio blob between phase 1 (stop recording) and phase 2 (API call)
  const pendingAudioBlobRef = useRef<Blob | null>(null);

  // 종료 다이얼로그 확인 핸들러 — Phase 1: stop recording + show undo toast
  const handleEndConfirm = async () => {
    setIsEnding(true);
    undoCancelledRef.current = false;

    // 0. 노트 마지막 저장 보장 (3초 디바운스 대기 없이 즉시)
    if (meetingId) {
      try {
        const { saveNote } = useNoteStore.getState();
        await saveNote(meetingId);
      } catch {
        // 저장 실패해도 종료 플로우는 계속 진행
      }
    }

    if (isRealtimeMode) {
      stopStreaming();
      await stopTranscriptionSession();
    }

    // 1. 녹음 중지 + Blob 합성 (즉시 수행)
    let audioBlob: Blob | null = null;
    if (recorderState === 'recording' || recorderState === 'stopping') {
      audioBlob = await stopRecording();
    }
    pendingAudioBlobRef.current = audioBlob;

    setShowEndDialog(false);

    // 2. 5초 undo 윈도우 — 서버 종료 API 호출을 지연
    pushUndoToast({
      title: '회의를 종료합니다',
      description: '5초 내에 취소할 수 있습니다.',
      durationMs: 5000,
      onUndo: () => {
        // 종료 취소: 서버에 아직 endMeeting을 호출하지 않았으므로 클라이언트 상태만 복원
        undoCancelledRef.current = true;
        pendingAudioBlobRef.current = null;
        setIsEnding(false);

        // 녹음은 이미 중지되었으므로 재시작하지 않지만, 회의 상태는 유지
        pushToast({
          title: '회의 종료를 취소했습니다',
          description: '녹음은 중지되었지만 회의는 계속 진행됩니다. 노트 작성을 계속하세요.',
          variant: 'info',
        });
      },
      onExpire: () => {
        // 5초 경과: 실제 endMeeting API 호출 + 후속 처리
        if (!undoCancelledRef.current) {
          void proceedWithEndMeeting();
        }
      },
    });
  };

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
  }, [currentMeeting?.status, pushToast, navigateHome, showProcessing]);

  // 회의 없음 상태
  if (!currentMeeting) {
    if (isLeavingPage) {
      return null;
    }

    if (isRecoveringMeeting) {
      return (
        <div className="app-shell flex min-h-dvh items-center justify-center p-6">
          <div className="glass-surface w-full max-w-xl p-7 text-center">
            <h1 className="text-2xl font-semibold">회의 상태를 복구하는 중입니다</h1>
            <p className="mt-2 text-sm text-muted">
              잠시만 기다려주세요. 마지막으로 열었던 회의를 확인하고 있습니다.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell flex min-h-dvh items-center justify-center p-6">
        <div className="glass-surface w-full max-w-xl p-7 text-center">
          <h1 className="text-2xl font-semibold">진행 중인 회의가 없습니다</h1>
          <p className="mt-2 text-sm text-muted">새 회의를 시작하면 이 화면에서 노트와 전사를 함께 관리할 수 있습니다.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/" className="btn-neo inline-flex">
              홈으로 이동
            </Link>
            <Link href="/meeting/new" className="btn-neo inline-flex border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white">
              새 회의 시작
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (currentMeeting.status !== MeetingStatus.RECORDING && !showProcessing) {
    return null; // 홈으로 리다이렉트 중
  }

  return (
    <div className="app-shell min-h-dvh p-4 sm:p-5">
      <div className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-[1400px] flex-col gap-3">
        {/* 헤더 */}
        <header className="glass-surface px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted">LIVE SESSION</p>
              <h1 className="text-xl font-semibold">{currentMeeting.title || '제목 없는 회의'}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 녹음 상태 배지 — 모바일에서 숨김 */}
              <span className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${recBadge.className}`}>
                {permission === 'denied' || permission === 'unsupported' ? (
                  <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
                ) : (
                  <Mic className="mr-1 inline-block h-3.5 w-3.5" />
                )}
                {recBadge.label}
              </span>

              {/* 연결 상태 배지 — 모바일에서 숨김 */}
              <span className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${connectionBadge.className}`}>
                <Radio className="mr-1 inline-block h-3.5 w-3.5" />
                {connectionBadge.label}
              </span>

              {/* 마이크 거부 배너 닫은 후 "노트 전용" 배지 표시 */}
              {micBannerDismissed && permission === 'denied' && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
                  노트 전용
                </span>
              )}

              {/* 타이머 */}
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">
                <Timer className="mr-1 inline-block h-3.5 w-3.5" />
                {formatTime(elapsedSeconds)}
              </span>

              {/* 마이크 선택 (디바이스 2개 이상일 때만) */}
              {devices.length > 1 && (
                <select
                  value={selectedDeviceId || ''}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  className="rounded-lg border border-[var(--line-soft)] bg-white px-2 py-1 text-xs"
                  aria-label="마이크 선택"
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}

              <button type="button" onClick={handleGoHome} className="btn-neo inline-flex text-xs text-muted">
                <ArrowLeft className="h-3.5 w-3.5" />
                목록으로
              </button>
              <button
                type="button"
                onClick={() => setShowEndDialog(true)}
                disabled={isLoading || isEnding}
                className="btn-neo inline-flex border-transparent bg-rose-600 px-3 py-2 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                회의 종료
              </button>
            </div>
          </div>
        </header>

        {/* 상태 배너들 — 우선순위 기반 최대 1개 표시 + 접기/펼치기 */}
        {(() => {
          const banners: { variant: 'error' | 'warning' | 'info'; title: string; message: string; onDismiss?: () => void }[] = [];

          if (error) {
            banners.push({ variant: 'error', title: '회의 상태 오류', message: error });
          }
          if (permission === 'unsupported') {
            banners.push({
              variant: 'error',
              title: '마이크 미지원 브라우저',
              message: '현재 브라우저는 마이크 캡처를 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.',
            });
          }
          if (recorderError) {
            banners.push({ variant: 'warning', title: '녹음 오류', message: recorderError });
          }
          if (permission === 'denied' && !micBannerDismissed) {
            banners.push({
              variant: 'warning',
              title: '마이크 접근이 차단되었습니다',
              message: '노트 전용 모드로 진행 중입니다. 전사 데이터 없이 노트 기반으로만 결과를 생성합니다. 브라우저 설정에서 마이크 권한을 허용하면 녹음이 가능합니다.',
              onDismiss: () => setMicBannerDismissed(true),
            });
          }
          if (audioCaptureError && permission !== 'denied' && permission !== 'unsupported') {
            banners.push({ variant: 'warning', title: '마이크 연결 오류', message: audioCaptureError });
          }
          if (isRealtimeMode && transcriptionError) {
            banners.push({
              variant: 'warning',
              title: '전사 연결 불안정',
              message: '전사 서버와의 연결이 지연되고 있습니다. 노트는 계속 저장됩니다.',
            });
          }
          if (isRealtimeMode && audioStreamingError) {
            banners.push({ variant: 'warning', title: '오디오 스트리밍 중단', message: audioStreamingError });
          }

          // 우선순위 정렬: error > warning > info
          const priorityOrder = { error: 0, warning: 1, info: 2 } as const;
          banners.sort((a, b) => priorityOrder[a.variant] - priorityOrder[b.variant]);

          if (banners.length === 0) return null;

          const [primary, ...rest] = banners;

          return (
            <>
              <StatusBanner
                variant={primary.variant}
                title={primary.title}
                message={primary.message}
                onDismiss={primary.onDismiss}
              />
              {rest.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowExtraBanners((v) => !v)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showExtraBanners ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {rest.length}개 추가 알림
                  </button>
                  {showExtraBanners &&
                    rest.map((b, i) => (
                      <StatusBanner
                        key={i}
                        variant={b.variant}
                        title={b.title}
                        message={b.message}
                        onDismiss={b.onDismiss}
                      />
                    ))}
                </>
              )}
            </>
          );
        })()}

        {/* 모바일 탭 전환 버튼 */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobilePanel('note')}
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
            onClick={() => setMobilePanel('transcript')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mobilePanel === 'transcript'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            전사
          </button>
        </div>

        {/* 메인 콘텐츠: 노트 + 전사 패널 */}
        {/* 데스크톱: 그리드로 양쪽 표시 / 모바일: 탭에 따라 한 패널씩 표시 */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className={`glass-surface min-h-0 overflow-hidden ${mobilePanel !== 'note' ? 'hidden lg:block' : ''}`}>
            <ErrorBoundary>
              <NoteEditor meetingId={currentMeeting.id} />
            </ErrorBoundary>
          </section>

          <aside className={`glass-surface min-h-0 overflow-hidden ${mobilePanel !== 'transcript' ? 'hidden lg:block' : ''}`}>
            <ErrorBoundary>
              <TranscriptPanel
                segments={segments}
                partial={partial}
                isConnected={isConnected}
                hasActiveSession={hasActiveSession}
                isRealtimeMode={isRealtimeMode}
                micPermission={permission}
                meetingId={currentMeeting.id}
                error={transcriptionError || audioStreamingError}
              />
            </ErrorBoundary>
          </aside>
        </div>
      </div>

      {/* 처리 진행 상태 (회의 종료 후) — 비차단: 홈 이동 허용 */}
      {showProcessing && meetingId && (
        <div className="mx-auto w-full max-w-lg p-4">
          <ProcessingProgress
            meetingId={meetingId}
            uploadState={uploadState}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onComplete={handleProcessingComplete}
          />
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setShowProcessing(false);
                setMeetingIdFromQuery('');
                setCurrentMeeting(null);
                navigateHome();
              }}
              className="btn-neo inline-flex text-xs text-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              홈으로 이동 (백그라운드에서 계속 처리)
            </button>
          </div>
        </div>
      )}

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
