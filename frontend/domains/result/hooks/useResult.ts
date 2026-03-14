import { useEffect, useRef, useState } from 'react';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useResultStore } from '../stores/resultStore';

/** 재생성 폴링 폴백 최대 대기 시간 (2분) */
const REGENERATE_POLL_TIMEOUT_MS = 2 * 60 * 1000;

function getInitialVisibility() {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState === 'visible';
}

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
    exportPDF,
    exportDOCX,
    clearResult,
  } = useResultStore();

  const regenerateStartRef = useRef<number | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(getInitialVisibility);

  // 결과 로드
  useEffect(() => {
    if (meetingId) {
      void fetchResult(meetingId);
    }

    return () => {
      clearResult();
    };
  }, [meetingId, fetchResult, clearResult]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsPageVisible(visible);

      if (visible && meetingId && (isPending || isRegenerating)) {
        void fetchResult(meetingId, { silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [meetingId, isPending, isRegenerating, fetchResult]);

  useMeetingStatus({
    meetingId,
    enabled: Boolean(meetingId),
    onResultRegenerate: (event) => {
      useResultStore.getState().applyRegenerateEvent(event);
    },
  });

  // 처리 중 결과는 주기적으로 재조회해 새로고침 없이 자동 반영
  useEffect(() => {
    if (!meetingId || !isPending || !isPageVisible) return;

    const timerId = window.setInterval(() => {
      void fetchResult(meetingId, { silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [meetingId, isPending, isPageVisible, fetchResult]);

  // 재생성 시작 시간 기록
  useEffect(() => {
    if (isRegenerating) {
      regenerateStartRef.current = Date.now();
    } else {
      regenerateStartRef.current = null;
    }
  }, [isRegenerating]);

  // 재생성 중 폴링 폴백 (WebSocket 미연결 시 안전장치) + 타임아웃
  useEffect(() => {
    if (!meetingId || !isRegenerating || !isPageVisible) return;

    const timerId = window.setInterval(() => {
      // 타임아웃 체크: 2분 초과 시 강제 해제
      if (
        regenerateStartRef.current &&
        Date.now() - regenerateStartRef.current > REGENERATE_POLL_TIMEOUT_MS
      ) {
        useResultStore.setState({
          isRegenerating: false,
          error: 'AI 회의록 재생성이 예상보다 오래 걸리고 있습니다. 페이지를 새로고침해주세요.',
        });
        return;
      }
      void fetchResult(meetingId, { silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [meetingId, isRegenerating, isPageVisible, fetchResult]);

  return {
    result,
    isLoading,
    isRegenerating,
    isPending,
    isMissingMeeting,
    error,
    updateResult: (content: string) => updateResult(meetingId, content),
    regenerateResult: (promptId: string) => regenerateResult(meetingId, promptId),
    exportPDF: () => exportPDF(meetingId),
    exportDOCX: () => exportDOCX(meetingId),
  };
}
