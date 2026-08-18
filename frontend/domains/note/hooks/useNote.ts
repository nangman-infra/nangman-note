import { useEffect, useRef } from 'react';
import { useNoteStore } from '../stores/noteStore';
import { useDebounce } from '@/hooks/useDebounce';
import { AUTO_SAVE_DELAY } from '@/lib/constants';

export function useNote(meetingId: string) {
  const {
    noteContent,
    isSaving,
    lastSaved,
    error,
    restoredFromBackup,
    setContent,
    saveNote,
    loadNote,
    clearNote,
  } = useNoteStore();
  const lastPersistedContentRef = useRef('');
  const readyMeetingIdRef = useRef<string | null>(null);

  const debouncedContent = useDebounce(noteContent, AUTO_SAVE_DELAY);

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
        // 오프라인 백업이 복원됐다면 아직 서버에 없는 내용이므로
        // persisted 기준값을 비워 자동 저장이 트리거되게 한다.
        const wasRestored =
          useNoteStore.getState?.().restoredFromBackup ?? false;
        lastPersistedContentRef.current = wasRestored ? '' : loadedContent;
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

  // 언마운트 flush: debounce 대기 중 페이지를 떠나면 마지막 입력이
  // 저장되지 않은 채 유실되므로, 정리 시점에 dirty 내용을 즉시 저장한다.
  useEffect(() => {
    if (!meetingId) return;
    return () => {
      const state = useNoteStore.getState?.();
      if (!state) return;
      if (
        state.isDirty &&
        readyMeetingIdRef.current === meetingId &&
        state.noteContent !== lastPersistedContentRef.current
      ) {
        void saveNote(meetingId);
      }
    };
  }, [meetingId, saveNote]);

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
    restoredFromBackup,
    setContent,
    clearNote,
  };
}
