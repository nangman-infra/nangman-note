import { useEffect, useRef } from 'react';
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
  const lastPersistedContentRef = useRef('');
  const readyMeetingIdRef = useRef<string | null>(null);

  const debouncedContent = useDebounce(noteContent, 3000);

  // 노트 로드
  useEffect(() => {
    if (!meetingId) {
      readyMeetingIdRef.current = null;
      lastPersistedContentRef.current = '';
      clearNote();
      return;
    }

    let disposed = false;
    readyMeetingIdRef.current = null;
    lastPersistedContentRef.current = '';
    clearNote();

    const restore = async () => {
      const loadedContent = await loadNote(meetingId);
      if (!disposed) {
        lastPersistedContentRef.current = loadedContent;
        readyMeetingIdRef.current = meetingId;
      }
    };
    void restore();

    return () => {
      disposed = true;
    };
  }, [meetingId, loadNote, clearNote]);

  // 자동 저장
  useEffect(() => {
    if (!meetingId) return;
    if (readyMeetingIdRef.current !== meetingId) return;
    if (debouncedContent === lastPersistedContentRef.current) return;

    const persist = async () => {
      const saved = await saveNote(meetingId);
      if (saved) {
        lastPersistedContentRef.current = debouncedContent;
      }
    };
    void persist();
  }, [debouncedContent, meetingId, saveNote]);

  useEffect(() => {
    if (!meetingId) {
      readyMeetingIdRef.current = null;
      lastPersistedContentRef.current = '';
    }
  }, [meetingId]);

  return {
    noteContent,
    isSaving,
    lastSaved,
    error,
    setContent,
    clearNote,
  };
}
