import { useEffect } from 'react';
import { useResultStore } from '../stores/resultStore';

export function useResult(meetingId: string) {
  const {
    result,
    isLoading,
    isRegenerating,
    error,
    fetchResult,
    updateResult,
    regenerateResult,
    exportPDF,
    clearResult,
  } = useResultStore();

  // 결과 로드
  useEffect(() => {
    if (meetingId) {
      fetchResult(meetingId);
    }

    return () => {
      clearResult();
    };
  }, [meetingId, fetchResult, clearResult]);

  return {
    result,
    isLoading,
    isRegenerating,
    error,
    updateResult: (content: string) => updateResult(meetingId, content),
    regenerateResult: (promptId: string) => regenerateResult(meetingId, promptId),
    exportPDF: () => exportPDF(meetingId),
  };
}
