import { create } from 'zustand';
import { noteApi } from '../api/noteApi';
import { NOTE_MAX_LENGTH, type Note } from '../types/note.types';
import { newDraftKey, readDrafts, removeDraft, writeDraft, type NoteDraft } from './noteDrafts';

interface NoteSnapshot {
  activeMeetingId: string | null;
  noteContent: string;
  isDirty: boolean;
  isLoading: boolean;
  hasLoaded: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  errorKind: 'load' | 'save' | 'conflict' | null;
  retryable: boolean;
  saveFailures: number;
  backupError: boolean;
  restoredFromBackup: boolean;
  contentRevision: number;
  serverNote: Note | null;
  conflict: Note | null;
  recoveryDrafts: NoteDraft[];
}

interface NoteState extends NoteSnapshot {
  setContent: (content: string) => void;
  saveNote: (meetingId: string) => Promise<boolean>;
  loadNote: (meetingId: string) => Promise<string>;
  resolveConflict: (choice: 'local' | 'server') => void;
  restoreDraft: (key: string) => void;
  clearNote: () => void;
}

interface NoteSession {
  state: NoteSnapshot;
  draftKey: string;
  baseRevision: number | null;
  ownDraft: NoteDraft | null;
  restoredDraft: NoteDraft | null;
  saving?: Promise<boolean>;
  loading?: Promise<string>;
}

const emptySnapshot = (): NoteSnapshot => ({
  activeMeetingId: null, noteContent: '', isDirty: false, isLoading: false,
  hasLoaded: false, isSaving: false, lastSaved: null, error: null,
  errorKind: null, retryable: true, saveFailures: 0, backupError: false,
  restoredFromBackup: false, contentRevision: 0, serverNote: null,
  conflict: null, recoveryDrafts: [],
});

function statusCode(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'statusCode' in error
    ? Number(error.statusCode) : undefined;
}

function isRetryable(error: unknown): boolean {
  const status = statusCode(error);
  return status === undefined || status >= 500 || status === 408 || status === 429;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : '노트를 저장하지 못했습니다.';
const conflictMessage = '다른 곳에서 수정된 노트가 있습니다. 두 내용을 확인한 뒤 저장할 내용을 선택해주세요.';

export const useNoteStore = create<NoteState>((set) => {
  let active: NoteSession | null = null;
  // Sessions survive navigation until their pending writes finish. Requests for
  // the same meeting are ordered even if the user leaves and immediately returns.
  const saves = new Map<string, Promise<boolean>>();
  // If browser storage fails, keep a recoverable copy across SPA navigation.
  // The close guard must outlive the editor component in this case.
  const memoryDrafts = new Map<string, NoteDraft>();
  const protectMemoryDrafts = (event: BeforeUnloadEvent) => {
    if (memoryDrafts.size === 0) return;
    event.preventDefault();
    event.returnValue = '';
  };
  const updateMemoryGuard = () => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('beforeunload', protectMemoryDrafts);
    if (memoryDrafts.size > 0) window.addEventListener('beforeunload', protectMemoryDrafts);
  };

  const publish = (session: NoteSession, patch: Partial<NoteSnapshot>) => {
    session.state = { ...session.state, ...patch };
    if (active === session) set(session.state);
  };

  const backup = (session: NoteSession) => {
    const draft: NoteDraft = {
      key: session.draftKey, content: session.state.noteContent,
      baseRevision: session.baseRevision, savedAt: Date.now(),
    };
    const ok = writeDraft(draft);
    if (ok) {
      session.ownDraft = draft;
      memoryDrafts.delete(session.state.activeMeetingId!);
    } else {
      memoryDrafts.set(session.state.activeMeetingId!, draft);
    }
    updateMemoryGuard();
    publish(session, { backupError: !ok });
  };

  const clearBackups = (session: NoteSession) => {
    if (session.ownDraft) removeDraft(session.ownDraft);
    if (session.restoredDraft) removeDraft(session.restoredDraft);
    session.ownDraft = null;
    session.restoredDraft = null;
    memoryDrafts.delete(session.state.activeMeetingId!);
    updateMemoryGuard();
  };

  const acceptServer = (session: NoteSession, note: Note, replaceContent = false) => {
    session.baseRevision = note.revision;
    const content = replaceContent ? note.content : session.state.noteContent;
    const isDirty = content !== note.content;
    publish(session, {
      noteContent: content, serverNote: note, hasLoaded: true, isDirty,
      lastSaved: note.revision > 0 ? new Date(note.updatedAt) : null,
      error: null, errorKind: null, conflict: null, retryable: true, saveFailures: 0,
      restoredFromBackup: isDirty && session.state.restoredFromBackup,
    });
    if (isDirty) backup(session);
    else {
      clearBackups(session);
      publish(session, { backupError: false });
    }
  };

  const loadNote = (meetingId: string): Promise<string> => {
    if (!meetingId) return Promise.resolve('');
    if (active?.state.activeMeetingId === meetingId && active.loading) return active.loading;
    if (active?.state.activeMeetingId !== meetingId) {
      const drafts = readDrafts(meetingId);
      const memoryDraft = memoryDrafts.get(meetingId);
      const restoredDraft = memoryDraft ?? drafts[0] ?? null;
      active = {
        state: {
          ...emptySnapshot(), activeMeetingId: meetingId,
          noteContent: restoredDraft?.content ?? '', isDirty: restoredDraft !== null,
          restoredFromBackup: restoredDraft !== null,
          recoveryDrafts: memoryDraft ? drafts : drafts.slice(1),
          backupError: Boolean(memoryDraft),
        },
        baseRevision: restoredDraft?.baseRevision ?? null,
        draftKey: newDraftKey(meetingId), ownDraft: null, restoredDraft,
      };
    }
    const session = active;
    publish(session, { isLoading: true, error: null, errorKind: null });
    const loading = (async () => {
      try {
        await saves.get(meetingId);
        const note = await noteApi.get(meetingId);
        if (session.state.isDirty && session.state.noteContent !== note.content && session.baseRevision !== note.revision) {
          publish(session, {
            hasLoaded: true, serverNote: note, conflict: note, errorKind: 'conflict',
            error: conflictMessage, retryable: false,
            lastSaved: note.revision > 0 ? new Date(note.updatedAt) : null,
          });
        } else {
          acceptServer(session, note, !session.state.isDirty);
        }
      } catch (error) {
        publish(session, { error: errorMessage(error), errorKind: 'load', retryable: isRetryable(error) });
      } finally {
        publish(session, { isLoading: false });
        session.loading = undefined;
      }
      return session.state.noteContent;
    })();
    session.loading = loading;
    return loading;
  };

  const saveNote = (meetingId: string): Promise<boolean> => {
    const session = active;
    if (!session || session.state.activeMeetingId !== meetingId) return Promise.resolve(false);
    if (session.saving) return session.saving;
    if (session.state.isLoading || !session.state.hasLoaded || session.state.errorKind === 'load' || session.state.errorKind === 'conflict') return Promise.resolve(false);
    if (!session.state.isDirty) return Promise.resolve(true);

    publish(session, { isSaving: true });
    const saving = (async () => {
      try {
        await saves.get(meetingId);
        // Drain the latest input as well, so manual save / meeting completion
        // cannot report success while a newer edit remains unsaved.
        while (session.state.isDirty) {
          const content = session.state.noteContent;
          if (content.length > NOTE_MAX_LENGTH) {
            publish(session, { error: '노트는 최대 100,000자까지 저장할 수 있습니다. 내용을 줄여주세요.', errorKind: 'save', retryable: false });
            return false;
          }
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            publish(session, { error: '오프라인입니다. 연결되면 자동으로 저장합니다.', errorKind: 'save', retryable: true });
            return false;
          }
          publish(session, { error: null, errorKind: null });
          try {
            const saved = await noteApi.save(meetingId, content, session.baseRevision!);
            acceptServer(session, saved);
          } catch (error) {
            if (statusCode(error) === 409) {
              publish(session, { error: conflictMessage, errorKind: 'conflict', retryable: false });
              try {
                const current = await noteApi.get(meetingId);
                if (current.content === session.state.noteContent) acceptServer(session, current);
                else publish(session, { serverNote: current, conflict: current });
              } catch {
                // Keep the draft and conflict barrier until a refresh succeeds.
              }
            } else {
              publish(session, { error: errorMessage(error), errorKind: 'save', retryable: isRetryable(error), saveFailures: session.state.saveFailures + 1 });
            }
            return !session.state.isDirty;
          }
        }
        return true;
      } finally {
        publish(session, { isSaving: false });
        session.saving = undefined;
      }
    })();
    session.saving = saving;
    saves.set(meetingId, saving);
    void saving.finally(() => { if (saves.get(meetingId) === saving) saves.delete(meetingId); });
    return saving;
  };

  return {
    ...emptySnapshot(), loadNote, saveNote,
    setContent: (content) => {
      const session = active;
      if (!session || session.state.noteContent === content) return;
      publish(session, {
        noteContent: content, isDirty: true, contentRevision: session.state.contentRevision + 1,
        ...(session.state.errorKind === 'save' ? { error: null, errorKind: null, retryable: true, saveFailures: 0 } : {}),
      });
      // Persist before returning to the editor, including deliberate empty text.
      backup(session);
    },
    resolveConflict: (choice) => {
      const session = active;
      if (!session?.state.conflict) return;
      acceptServer(session, session.state.conflict, choice === 'server');
    },
    restoreDraft: (key) => {
      const session = active;
      const draft = session?.state.recoveryDrafts.find((item) => item.key === key);
      if (!session || !draft || session.state.isDirty || session.state.isSaving) return;
      session.restoredDraft = draft;
      session.baseRevision = draft.baseRevision;
      publish(session, { noteContent: draft.content, isDirty: true, restoredFromBackup: true, recoveryDrafts: session.state.recoveryDrafts.filter((item) => item.key !== key) });
      backup(session);
      void loadNote(session.state.activeMeetingId!);
    },
    clearNote: () => {
      active = null;
      set(emptySnapshot());
    },
  };
});
