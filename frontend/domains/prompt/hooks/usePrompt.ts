import { useEffect } from 'react';
import { usePromptStore } from '../stores/promptStore';

export function usePrompt() {
  const {
    prompts,
    selectedPromptId,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    setSelectedPrompt,
  } = usePromptStore();

  // 초기 로드
  useEffect(() => {
    if (prompts.length === 0) {
      fetchPrompts();
    }
  }, [prompts.length, fetchPrompts]);

  return {
    prompts,
    selectedPromptId,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    setSelectedPrompt,
  };
}
