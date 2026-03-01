'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Mic, MicOff, Radio, Square, Timer } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { meetingApi } from '@/domains/meeting/api/meetingApi';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { useBeforeUnloadGuard } from '@/domains/meeting/hooks/useBeforeUnloadGuard';
import { EndMeetingDialog } from '@/domains/meeting/components/EndMeetingDialog';
import { MeetingTranscriptionMode } from '@/domains/meeting/types/meeting.types';
import { MeetingStatus } from '@/domains/meeting/types/meeting.types';
import { NoteEditor } from '@/domains/note/components/NoteEditor';
import { useTranscription } from '@/domains/transcription/hooks/useTranscription';
import { useNoteStore } from '@/domains/note/stores/noteStore';
import { useAudioCapture, type AudioCapturePermission } from '@/domains/transcription/hooks/useAudioCapture';
import { useMediaRecorder } from '@/domains/transcription/hooks/useMediaRecorder';
import { useAudioUpload } from '@/domains/transcription/hooks/useAudioUpload';
import { transcriptionApi } from '@/domains/transcription/api/transcriptionApi';
import { ProcessingProgress } from '@/domains/meeting/components/ProcessingProgress';
import { formatTime } from '@/lib/utils/date';

export default function InProgressMeetingPage() {
  const router = useRouter();
  const { pushToast } = useFeedback();
  const { currentMeeting, isLoading, error, endMeeting, setCurrentMeeting } =
    useMeeting();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRecoveringMeeting, setIsRecoveringMeeting] = useState(false);
  const [meetingIdFromQuery, setMeetingIdFromQuery] = useState('');

  // 오디오 캡처 (마이크 권한 + 디바이스 선택)
  const {
    permission,
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

  const meetingId = currentMeeting?.id || meetingIdFromQuery;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMeetingIdFromQuery(params.get('meetingId')?.trim() ?? '');
  }, []);
  const transcriptionMode =
    currentMeeting?.transcriptionMode ?? MeetingTranscriptionMode.BATCH;
  const isRealtimeMode =
    transcriptionMode === MeetingTranscriptionMode.REALTIME;
  const { isConnected, error: transcriptionError } = useTranscription(
    meetingId,
    isRealtimeMode,
  );

  // 탭 닫기 방지: 녹음 중일 때
  const isActiveRecording = recorderState === 'recording';
  useBeforeUnloadGuard(isActiveRecording);

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
      router.replace('/');
    }
  }, [currentMeeting, showProcessing, setCurrentMeeting, router]);

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
          router.replace('/');
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
        router.replace('/');
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
    pushToast,
    router,
    setCurrentMeeting,
  ]);

  const elapsedSeconds = currentMeeting?.startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(currentMeeting.startedAt).getTime()) / 1000))
    : 0;

  // 회의 시작 시 마이크 권한 요청 + 녹음 시작
  useEffect(() => {
    if (!meetingId || permission !== 'prompt') return;

    const init = async () => {
      const granted = await requestPermission();
      if (!granted) {
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

  // 마이크 스트림 획득 후 녹음 시작
  useEffect(() => {
    if (!stream || !meetingId || recorderState !== 'idle') return;
    startRecording(stream, meetingId);
  }, [stream, meetingId, recorderState, startRecording]);

  // 마이크 디바이스 변경 핸들러
  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      selectDevice(deviceId);
      // 디바이스 변경 후 재연결: 녹음 중이면 중지 후 재시작
      if (recorderState === 'recording') {
        await stopRecording();
        await cleanupChunks();
      }
      const granted = await requestPermission();
      if (granted) {
        // stream이 변경되면 위 useEffect에서 자동 재시작
      }
    },
    [selectDevice, recorderState, stopRecording, cleanupChunks, requestPermission],
  );

  // 연결 상태 배지
  const connectionBadge = !meetingId
    ? { label: '대기', className: 'bg-slate-100 text-slate-700' }
    : permission === 'denied'
      ? { label: '노트 전용', className: 'bg-amber-100 text-amber-800' }
    : !isRealtimeMode
      ? { label: '배치 전사 모드', className: 'bg-slate-100 text-slate-700' }
      : isConnected
        ? { label: '실시간 수집 연결됨', className: 'bg-emerald-100 text-emerald-800' }
        : { label: '실시간 수집 연결중', className: 'bg-amber-100 text-amber-800' };

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

  // 종료 다이얼로그 확인 핸들러
  const handleEndConfirm = async () => {
    setIsEnding(true);

    // 0. 노트 마지막 저장 보장 (3초 디바운스 대기 없이 즉시)
    if (meetingId) {
      try {
        const { saveNote } = useNoteStore.getState();
        await saveNote(meetingId);
      } catch {
        // 저장 실패해도 종료 플로우는 계속 진행
      }
    }

    let audioBlob: Blob | null = null;

    // 1. 녹음 중지 + Blob 합성
    if (recorderState === 'recording' || recorderState === 'stopping') {
      audioBlob = await stopRecording();
      stopCapture();
    } else {
      stopCapture();
    }

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
        description: error || '네트워크 상태를 확인해주세요.',
        variant: 'error',
      });
      return;
    }

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
        // 배치 전사 잡 트리거
        try {
          await transcriptionApi.queueBatchJob(meetingId, {
            mediaUri: uploadResult.mediaUri,
          });
        } catch {
          await endMeeting({ skipTranscription: true });
          setShowProcessing(false);
          pushToast({
            title: '배치 전사 잡 생성에 실패했습니다',
            description: '전사 없이 노트 기반 결과 생성으로 전환했습니다.',
            variant: 'error',
          });
          setMeetingIdFromQuery('');
          setCurrentMeeting(null);
          router.replace('/');
        }
      } else {
        await endMeeting({ skipTranscription: true });
        setShowProcessing(false);
          pushToast({
            title: '오디오 업로드에 실패했습니다',
            description: '전사 없이 노트 기반 결과 생성으로 전환했습니다.',
            variant: 'info',
          });
          setMeetingIdFromQuery('');
          setCurrentMeeting(null);
        router.replace('/');
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
      router.replace('/');
    }
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
    router.replace('/');
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

    router.replace('/');
  }, [currentMeeting?.status, pushToast, router, showProcessing]);

  // 회의 없음 상태
  if (!currentMeeting) {
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
            <Link href="/" className="btn-neo">
              홈으로 이동
            </Link>
            <Link href="/meeting/new" className="btn-neo border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white">
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
              {/* 녹음 상태 배지 */}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recBadge.className}`}>
                {permission === 'denied' || permission === 'unsupported' ? (
                  <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
                ) : (
                  <Mic className="mr-1 inline-block h-3.5 w-3.5" />
                )}
                {recBadge.label}
              </span>

              {/* 연결 상태 배지 */}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connectionBadge.className}`}>
                <Radio className="mr-1 inline-block h-3.5 w-3.5" />
                {connectionBadge.label}
              </span>

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

              <button type="button" onClick={handleGoHome} className="btn-neo text-xs text-muted">
                <ArrowLeft className="h-3.5 w-3.5" />
                목록으로
              </button>
              <button
                type="button"
                onClick={() => setShowEndDialog(true)}
                disabled={isLoading || isEnding}
                className="btn-neo border-transparent bg-rose-600 px-3 py-2 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                회의 종료
              </button>
            </div>
          </div>
        </header>

        {/* 상태 배너들 */}
        {error ? (
          <StatusBanner variant="error" title="회의 상태 오류" message={error} />
        ) : null}
        {recorderError ? (
          <StatusBanner variant="warning" title="녹음 오류" message={recorderError} />
        ) : null}
        {permission === 'denied' ? (
          <StatusBanner
            variant="warning"
            title="마이크 접근이 차단되었습니다"
            message="노트 전용 모드로 진행 중입니다. 전사 데이터 없이 노트 기반으로만 결과를 생성합니다. 브라우저 설정에서 마이크 권한을 허용하면 녹음이 가능합니다."
          />
        ) : null}
        {permission === 'unsupported' ? (
          <StatusBanner
            variant="error"
            title="마이크 미지원 브라우저"
            message="현재 브라우저는 마이크 캡처를 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요."
          />
        ) : null}
        {isRealtimeMode && transcriptionError ? (
          <StatusBanner
            variant="warning"
            title="전사 연결 불안정"
            message="전사 서버와의 연결이 지연되고 있습니다. 노트는 계속 저장됩니다."
          />
        ) : null}

        {/* 메인 콘텐츠: 노트 + 전사 패널 */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="glass-surface min-h-0 overflow-hidden">
            <NoteEditor meetingId={currentMeeting.id} />
          </section>

          <aside className="glass-surface min-h-0 overflow-hidden">
            <div className="border-b border-[var(--line-soft)] px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted">TRANSCRIPTION</p>
                <h2 className="mt-1 text-sm font-semibold">
                  {permission === 'denied'
                    ? '노트 전용 모드'
                    : isRealtimeMode
                      ? '실시간 수집 모니터'
                      : '배치 전사 대기'}
                </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-white px-2 py-1">
                  {isRealtimeMode
                    ? '실시간 텍스트: 준비중'
                    : '실시간 텍스트: 비활성'}
                </span>
                <span className="rounded-full bg-white px-2 py-1">Meeting ID: {currentMeeting.id.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="flex h-[calc(100%-84px)] flex-col">
              <div className="px-4 py-3 text-xs text-muted">
                {permission === 'denied' ? (
                  <>
                    <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
                    마이크 접근이 차단되어 전사가 비활성화되었습니다. 노트 작성에 집중해주세요.
                  </>
                ) : (
                  <>
                    <Mic className="mr-1 inline-block h-3.5 w-3.5" />
                    {isRealtimeMode
                      ? '실시간 모드는 확장 준비를 위한 수집 경로를 유지합니다. 최종 회의록은 노트와 배치/후처리 결과를 기준으로 생성됩니다.'
                      : '현재 회의는 배치 전사 모드입니다. 회의 종료 후 수집된 오디오가 AWS 배치 전사로 처리됩니다.'}
                  </>
                )}
              </div>
              <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted">
                {permission === 'denied'
                  ? '마이크 비활성 — 노트 전용 모드'
                  : isRealtimeMode
                    ? '실시간 텍스트 표시는 정식 STT 연동 이후 제공됩니다. 현재는 수집 경로만 활성화됩니다.'
                    : '실시간 전사가 비활성화되어 있습니다. 회의 종료 후 배치 전사를 실행합니다.'}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* 처리 진행 상태 (회의 종료 후) */}
      {showProcessing && meetingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-lg p-4">
            <ProcessingProgress
              meetingId={meetingId}
              uploadState={uploadState}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              onComplete={handleProcessingComplete}
            />
          </div>
        </div>
      )}

      {/* 종료 확인 모달 */}
      <EndMeetingDialog
        open={showEndDialog}
        isLoading={isEnding}
        onConfirm={handleEndConfirm}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
