import { useEffect, useRef } from 'react';
import { useAuthReady } from '@/hooks/useAuthReady';
import { usePromptStore } from '../stores/promptStore';

export function usePrompt() {
  const {
    prompts,
    isLoading,
    hasLoaded,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePromptStore();
  const isAuthReady = useAuthReady();
  // 이 consumer 마운트에서 이미 요청을 시도했는지. 실패 후 deps 변화로 effect 가
  // 다시 돌 때 무한 재요청되지 않도록 마운트당 1회로 제한한다.
  const attemptedRef = useRef(false);

  // 초기 로드: 인증이 준비된 뒤 마운트당 최대 1회.
  // (이전의 prompts.length === 0 조건은 실패 시 consumer 마운트마다 재요청을 만들어
  //  401 폭주의 원인이 됐다. 동시 마운트 중복 요청은 store 의 isLoading 가드가 막는다.)
  useEffect(() => {
    if (!isAuthReady || hasLoaded || isLoading || attemptedRef.current) {
      return;
    }
    attemptedRef.current = true;
    void fetchPrompts();
  }, [isAuthReady, hasLoaded, isLoading, fetchPrompts]);

  return {
    prompts,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
  };
}
