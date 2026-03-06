import { useEffect, useCallback } from 'react';
import { useResultStore } from '../stores/resultStore';

export function useResult(meetingId: string) {
  const {
    result,
    isLoading,
    isRegenerating,
    isPending,
    isMissingMeeting,
    error,
    fetchResult,
    updateResult,
    regenerateResult,
    applyRegenerateEvent,
    exportPDF,
    exportDOCX,
    clearResult,
  } = useResultStore();

  // 결과 로드
  useEffect(() => {
    if (meetingId) {
      void fetchResult(meetingId);
    }

    return () => {
      clearResult();
    };
  }, [meetingId, fetchResult, clearResult]);

  // 처리 중 결과는 주기적으로 재조회해 새로고침 없이 자동 반영
  useEffect(() => {
    if (!meetingId || !isPending) return;

    const timerId = window.setInterval(() => {
      void fetchResult(meetingId);
    }, 5000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [meetingId, isPending, fetchResult]);

  // 재생성 중 폴링 폴백 (WebSocket 미연결 시 안전장치)
  useEffect(() => {
    if (!meetingId || !isRegenerating) return;

    const timerId = window.setInterval(() => {
      void fetchResult(meetingId);
    }, 5000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [meetingId, isRegenerating, fetchResult]);

  const handleResultRegenerate = useCallback(
    (event: { meetingId: string; phase: string; errorMessage?: string }) => {
      applyRegenerateEvent(event);
    },
    [applyRegenerateEvent],
  );

  return {
    result,
    isLoading,
    isRegenerating,
    isPending,
    isMissingMeeting,
    error,
    updateResult: (content: string) => updateResult(meetingId, content),
    regenerateResult: (promptId: string) => regenerateResult(meetingId, promptId),
    handleResultRegenerate,
    exportPDF: () => exportPDF(meetingId),
    exportDOCX: () => exportDOCX(meetingId),
  };
}