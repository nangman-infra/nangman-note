import { useEffect } from 'react';
import { useNoteStore } from '../stores/noteStore';
import { useDebounce } from '@/hooks/useDebounce';

export function useNote(meetingId: string) {
  const {
    noteContent,
    isSaving,
    lastSaved,
    error,
    setContent,
    saveNote,
    loadNote,
    clearNote,
  } = useNoteStore();

  const debouncedContent = useDebounce(noteContent, 3000);

  // 노트 로드
  useEffect(() => {
    if (meetingId) {
      loadNote(meetingId);
    }
  }, [meetingId, loadNote]);

  // 자동 저장
  useEffect(() => {
    if (debouncedContent && meetingId) {
      saveNote(meetingId);
    }
  }, [debouncedContent, meetingId, saveNote]);

  return {
    noteContent,
    isSaving,
    lastSaved,
    error,
    setContent,
    clearNote,
  };
}
