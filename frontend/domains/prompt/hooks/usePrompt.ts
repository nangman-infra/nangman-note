import { useEffect } from 'react';
import { usePromptStore } from '../stores/promptStore';

export function usePrompt() {
  const {
    prompts,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePromptStore();

  // 초기 로드
  useEffect(() => {
    if (prompts.length === 0) {
      fetchPrompts();
    }
  }, [prompts.length, fetchPrompts]);

  return {
    prompts,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
  };
}
