import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useNoteStore } from '../stores/noteStore';
import { AUTO_SAVE_DELAY } from '@/lib/constants';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useNote(meetingId: string) {
  const state = useNoteStore();
  const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const { loadNote, saveNote, clearNote } = state;

  useEffect(() => {
    if (!meetingId) { clearNote(); return; }
    void loadNote(meetingId);
    return () => {
      if (useNoteStore.getState().activeMeetingId !== meetingId) return;
      void saveNote(meetingId);
      clearNote();
    };
  }, [meetingId, loadNote, saveNote, clearNote]);

  const { activeMeetingId, noteContent, isDirty, isSaving, isLoading, hasLoaded,
    errorKind, retryable, saveFailures } = state;

  useEffect(() => {
    if (activeMeetingId !== meetingId || !isDirty || isSaving || isLoading || !hasLoaded ||
      errorKind === 'load' || errorKind === 'conflict' || !retryable || !navigator.onLine) return;
    const delay = saveFailures ? Math.min(30_000, 2_000 * 2 ** Math.min(saveFailures - 1, 4)) : AUTO_SAVE_DELAY;
    const timer = window.setTimeout(() => void saveNote(meetingId), delay);
    return () => window.clearTimeout(timer);
  }, [activeMeetingId, meetingId, noteContent, isDirty, isSaving, isLoading, hasLoaded,
    errorKind, retryable, saveFailures, saveNote]);

  useEffect(() => {
    if (!meetingId) return;
    const reconnect = () => {
      const current = useNoteStore.getState();
      if (current.activeMeetingId !== meetingId || current.isSaving || current.isLoading || !navigator.onLine) return;
      if (!current.hasLoaded || current.errorKind === 'load' || !current.isDirty) void loadNote(meetingId);
      else if (current.errorKind !== 'conflict' && current.retryable) void saveNote(meetingId);
    };
    const flush = () => {
      if (useNoteStore.getState().isDirty) void saveNote(meetingId);
    };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); else reconnect(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (useNoteStore.getState().activeMeetingId === meetingId && useNoteStore.getState().isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', reconnect);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [meetingId, loadNote, saveNote]);

  const saveNow = useCallback(() => saveNote(meetingId), [meetingId, saveNote]);
  const reload = useCallback(() => loadNote(meetingId), [meetingId, loadNote]);
  return { ...state, isOnline, saveNow, reload };
}
