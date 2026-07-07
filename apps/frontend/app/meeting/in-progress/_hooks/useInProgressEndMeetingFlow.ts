'use client';

import { useCallback, useRef, useState } from 'react';
import { type Meeting, MeetingTranscriptionMode } from '@/domains/meeting';
import { useNoteStore } from '@/domains/note';
import { transcriptionApi, type UploadResult } from '@/domains/transcription';

type EndMeeting = (options?: {
  skipTranscription?: boolean;
  markAttentionRequired?: boolean;
}) => Promise<boolean>;

type PushToast = (options: {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}) => void;

type PushUndoToast = (options: {
  title: string;
  description?: string;
  durationMs: number;
  onUndo: () => void;
  onExpire: () => void;
}) => void;

interface UseInProgressEndMeetingFlowParams {
  meetingId: string;
  transcriptionMode: MeetingTranscriptionMode;
  isRealtimeMode: boolean;
  recorderState: string;
  error: string | null;
  endMeeting: EndMeeting;
  stopCapture: () => void;
  stopStreaming: () => void;
  stopTranscriptionSession: () => Promise<unknown>;
  stopRecording: () => Promise<Blob | null>;
  uploadAudio: (meetingId: string, blob: Blob) => Promise<UploadResult | null>;
  cleanupChunks: () => Promise<void>;
  pushToast: PushToast;
  pushUndoToast: PushUndoToast;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  setMeetingIdFromQuery: (meetingId: string) => void;
  setShowProcessing: (showProcessing: boolean) => void;
  navigateHome: () => void;
}

export function useInProgressEndMeetingFlow({
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
}: UseInProgressEndMeetingFlowParams) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const pendingAudioBlobRef = useRef<Blob | null>(null);
  const undoCancelledRef = useRef(false);

  const proceedWithEndMeeting = useCallback(async () => {
    const audioBlob = pendingAudioBlobRef.current;
    pendingAudioBlobRef.current = null;

    const shouldRunBatchTranscription =
      transcriptionMode === MeetingTranscriptionMode.BATCH &&
      Boolean(audioBlob && audioBlob.size > 0);

    const success = await endMeeting({
      skipTranscription: !shouldRunBatchTranscription,
    });
    if (!success) {
      setIsEnding(false);
      pushToast({
        title: '회의 종료에 실패했습니다',
        description:
          error ||
          '녹음은 유지된 상태입니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    stopCapture();
    setIsEnding(false);
    setShowEndDialog(false);

    if (shouldRunBatchTranscription && audioBlob && meetingId) {
      setShowProcessing(true);
      setMeetingIdFromQuery('');
      pushToast({
        title: '회의를 종료했습니다',
        description: '오디오 업로드 및 전사를 시작합니다.',
        variant: 'success',
      });

      const uploadResult = await uploadAudio(meetingId, audioBlob);
      await cleanupChunks();

      if (uploadResult) {
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
    transcriptionMode,
    endMeeting,
    error,
    stopCapture,
    meetingId,
    setShowProcessing,
    setMeetingIdFromQuery,
    pushToast,
    uploadAudio,
    cleanupChunks,
    setCurrentMeeting,
    navigateHome,
  ]);

  const handleEndConfirm = async () => {
    setIsEnding(true);
    undoCancelledRef.current = false;

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

    let audioBlob: Blob | null = null;
    if (recorderState === 'recording' || recorderState === 'stopping') {
      audioBlob = await stopRecording();
    }
    pendingAudioBlobRef.current = audioBlob;

    setShowEndDialog(false);

    pushUndoToast({
      title: '회의를 종료합니다',
      description: '5초 내에 취소할 수 있습니다.',
      durationMs: 5000,
      onUndo: () => {
        undoCancelledRef.current = true;
        pendingAudioBlobRef.current = null;
        setIsEnding(false);
        pushToast({
          title: '회의 종료를 취소했습니다',
          description:
            '녹음은 중지되었지만 회의는 계속 진행됩니다. 노트 작성을 계속하세요.',
          variant: 'info',
        });
      },
      onExpire: () => {
        if (!undoCancelledRef.current) {
          void proceedWithEndMeeting();
        }
      },
    });
  };

  return {
    showEndDialog,
    setShowEndDialog,
    isEnding,
    handleEndConfirm,
  };
}
