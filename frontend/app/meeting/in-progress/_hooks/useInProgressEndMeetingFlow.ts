'use client';

import { useCallback, useRef, useState } from 'react';
import { type Meeting, MeetingTranscriptionMode } from '@/domains/meeting';
import { useNoteStore } from '@/domains/note';
import {
  transcriptionApi,
  type RecordedSessionBlob,
  type UploadOptions,
  type UploadResult,
} from '@/domains/transcription';

type EndMeeting = (options?: {
  skipTranscription?: boolean;
  markAttentionRequired?: boolean;
}) => Promise<boolean>;

type PushToast = (options: {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}) => void;

interface UseInProgressEndMeetingFlowParams {
  meetingId: string;
  meetingStartedAt: string | null;
  transcriptionMode: MeetingTranscriptionMode;
  isRealtimeMode: boolean;
  recorderState: string;
  error: string | null;
  endMeeting: EndMeeting;
  stopCapture: () => void;
  stopStreaming: () => void;
  stopTranscriptionSession: () => Promise<unknown>;
  stopRecording: () => Promise<RecordedSessionBlob[]>;
  assembleSessions: () => Promise<RecordedSessionBlob[]>;
  uploadAudio: (
    meetingId: string,
    blob: Blob,
    options?: UploadOptions,
  ) => Promise<UploadResult | null>;
  cleanupChunks: () => Promise<void>;
  pushToast: PushToast;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  setMeetingIdFromQuery: (meetingId: string) => void;
  setShowProcessing: (showProcessing: boolean) => void;
  navigateHome: () => void;
}

const CONFIRM_UPLOAD_MAX_ATTEMPTS = 3;

export function useInProgressEndMeetingFlow({
  meetingId,
  meetingStartedAt,
  transcriptionMode,
  isRealtimeMode,
  recorderState,
  error,
  endMeeting,
  stopCapture,
  stopStreaming,
  stopTranscriptionSession,
  stopRecording,
  assembleSessions,
  uploadAudio,
  cleanupChunks,
  pushToast,
  setCurrentMeeting,
  setMeetingIdFromQuery,
  setShowProcessing,
  navigateHome,
}: UseInProgressEndMeetingFlowParams) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  /** 이미 업로드·확정된 세션 ID — 재시도 시 중복 업로드(전사 중복) 방지 */
  const uploadedSessionIdsRef = useRef<Set<string>>(new Set());

  const computeStartOffsetSeconds = useCallback(
    (session: RecordedSessionBlob): number => {
      if (!meetingStartedAt) return 0;
      const meetingStartMs = new Date(meetingStartedAt).getTime();
      if (!Number.isFinite(meetingStartMs)) return 0;
      return Math.max(0, (session.startedAt - meetingStartMs) / 1000);
    },
    [meetingStartedAt],
  );

  /**
   * 업로드 확정(confirm)을 재시도 포함으로 수행합니다.
   * 확정이 끝내 실패해도 파일은 이미 S3에 존재하므로, 백엔드의
   * 업로드 정합성 보정(30초 주기)이 자동으로 전사 잡을 큐잉합니다.
   * 따라서 확정 실패만으로 전사를 포기하지 않습니다.
   */
  const confirmUploadWithRetry = useCallback(
    async (uploadId: string): Promise<boolean> => {
      for (let attempt = 1; attempt <= CONFIRM_UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          await transcriptionApi.confirmUpload(meetingId, uploadId);
          return true;
        } catch {
          if (attempt < CONFIRM_UPLOAD_MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
      return false;
    },
    [meetingId],
  );

  /**
   * 녹음 세션들을 순서대로 업로드하고 확정합니다.
   * - 업로드(PUT) 실패 시: IndexedDB 청크를 보존한 채 false 반환 (재시도 가능)
   * - 전부 성공 시: 청크 정리 후 true 반환
   */
  const uploadSessions = useCallback(
    async (sessions: RecordedSessionBlob[]): Promise<boolean> => {
      let confirmFailedCount = 0;

      for (const session of sessions) {
        // 재시도 시 이미 업로드된 세션은 건너뛴다 (전사 구간 중복 방지)
        if (uploadedSessionIdsRef.current.has(session.sessionId)) {
          continue;
        }

        const uploadResult = await uploadAudio(meetingId, session.blob, {
          startOffsetSeconds: computeStartOffsetSeconds(session),
        });

        if (!uploadResult) {
          // 청크를 삭제하지 않는다 — 재시도가 가능해야 한다.
          return false;
        }

        uploadedSessionIdsRef.current.add(session.sessionId);

        const confirmed = await confirmUploadWithRetry(uploadResult.uploadId);
        if (!confirmed) {
          confirmFailedCount += 1;
        }
      }

      // 모든 파일이 S3에 올라갔으므로 로컬 청크는 정리해도 안전하다.
      await cleanupChunks();
      uploadedSessionIdsRef.current.clear();

      if (confirmFailedCount > 0) {
        pushToast({
          title: '전사 시작 확인이 지연되고 있습니다',
          description:
            '업로드는 완료되었습니다. 전사는 서버에서 곧 자동으로 시작됩니다.',
          variant: 'info',
        });
      }

      return true;
    },
    [
      uploadAudio,
      meetingId,
      computeStartOffsetSeconds,
      confirmUploadWithRetry,
      cleanupChunks,
      pushToast,
    ],
  );

  const runUploadFlow = useCallback(
    async (sessions: RecordedSessionBlob[]) => {
      setIsUploadingAudio(true);
      setUploadFailed(false);
      try {
        const uploaded = await uploadSessions(sessions);
        if (!uploaded) {
          setUploadFailed(true);
          pushToast({
            title: '오디오 업로드에 실패했습니다',
            description:
              '녹음 데이터는 안전하게 보관되어 있습니다. 재시도하거나 노트 기반으로 계속할 수 있습니다.',
            variant: 'error',
          });
        }
        return uploaded;
      } finally {
        setIsUploadingAudio(false);
      }
    },
    [uploadSessions, pushToast],
  );

  const proceedWithEndMeeting = useCallback(async () => {
    // 녹음 데이터는 항상 IndexedDB 기준으로 조립한다.
    // (인메모리 blob에 의존하면 종료 실패 후 재시도 시 오디오가 유실된다)
    let sessions: RecordedSessionBlob[] = [];
    try {
      sessions =
        recorderState === 'recording' || recorderState === 'stopping'
          ? await stopRecording()
          : await assembleSessions();
    } catch {
      sessions = [];
    }

    const shouldRunBatchTranscription =
      transcriptionMode === MeetingTranscriptionMode.BATCH &&
      sessions.some((session) => session.blob.size > 0);

    const success = await endMeeting({
      skipTranscription: !shouldRunBatchTranscription,
    });
    if (!success) {
      setIsEnding(false);
      pushToast({
        title: '회의 종료에 실패했습니다',
        description:
          error ||
          '녹음 데이터는 안전하게 보관되어 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    stopCapture();
    setIsEnding(false);
    setShowEndDialog(false);

    if (shouldRunBatchTranscription && meetingId) {
      setShowProcessing(true);
      setMeetingIdFromQuery('');
      pushToast({
        title: '회의를 종료했습니다',
        description: '오디오 업로드 및 전사를 시작합니다.',
        variant: 'success',
      });

      await runUploadFlow(sessions.filter((session) => session.blob.size > 0));
      // 업로드 실패 시에는 처리 패널의 재시도/노트 기반 계속 버튼으로 이어진다.
      return;
    }

    await cleanupChunks();
    pushToast({
      title: '회의를 종료했습니다',
      description: '노트 기반으로 결과를 생성합니다.',
      variant: 'success',
    });
    setMeetingIdFromQuery('');
    setCurrentMeeting(null);
    navigateHome();
  }, [
    recorderState,
    stopRecording,
    assembleSessions,
    transcriptionMode,
    endMeeting,
    error,
    stopCapture,
    meetingId,
    setShowProcessing,
    setMeetingIdFromQuery,
    pushToast,
    runUploadFlow,
    cleanupChunks,
    setCurrentMeeting,
    navigateHome,
  ]);

  /**
   * 종료 확인 다이얼로그에서 확정 시 즉시 종료를 수행합니다.
   *
   * 이전 구현은 5초 undo 토스트의 만료 콜백에 종료 처리를 매달았는데,
   * 백그라운드 탭 타이머 스로틀링·토스트 evict 시 종료가 영영 실행되지 않는
   * 치명적 결함이 있어 제거했습니다. 확인은 다이얼로그가 담당합니다.
   */
  const handleEndConfirm = async () => {
    setIsEnding(true);

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

    setShowEndDialog(false);
    await proceedWithEndMeeting();
  };

  const handleContinueWithoutAudioInternal = useCallback(async () => {
    const ended = await endMeeting({
      skipTranscription: true,
      markAttentionRequired: true,
    });
    if (!ended) {
      // 종료 실패 시 청크를 보존한 채 알린다 (재시도 여지 유지)
      pushToast({
        title: '처리 전환에 실패했습니다',
        description: '네트워크 상태를 확인한 뒤 다시 시도해주세요. 녹음 데이터는 보존됩니다.',
        variant: 'error',
      });
      return;
    }
    await cleanupChunks();
    uploadedSessionIdsRef.current.clear();
    setShowProcessing(false);
    setUploadFailed(false);
    pushToast({
      title: '노트 기반으로 결과를 생성합니다',
      description: '전사 없이 회의록을 작성합니다.',
      variant: 'info',
    });
    setMeetingIdFromQuery('');
    setCurrentMeeting(null);
    navigateHome();
  }, [
    endMeeting,
    cleanupChunks,
    setShowProcessing,
    pushToast,
    setMeetingIdFromQuery,
    setCurrentMeeting,
    navigateHome,
  ]);

  /** 업로드 실패 시 IndexedDB에 보존된 청크로 업로드를 재시도합니다. */
  const handleRetryUpload = useCallback(async () => {
    let sessions: RecordedSessionBlob[] = [];
    try {
      sessions = await assembleSessions();
    } catch {
      sessions = [];
    }

    const uploadable = sessions.filter((session) => session.blob.size > 0);
    if (uploadable.length === 0) {
      pushToast({
        title: '재시도할 녹음 데이터를 찾지 못했습니다',
        description: '노트 기반으로 결과 생성을 계속합니다.',
        variant: 'error',
      });
      await handleContinueWithoutAudioInternal();
      return;
    }

    await runUploadFlow(uploadable);
  }, [
    assembleSessions,
    runUploadFlow,
    pushToast,
    handleContinueWithoutAudioInternal,
  ]);

  return {
    showEndDialog,
    setShowEndDialog,
    isEnding,
    isUploadingAudio,
    uploadFailed,
    handleEndConfirm,
    handleRetryUpload,
    handleContinueWithoutAudio: handleContinueWithoutAudioInternal,
  };
}
