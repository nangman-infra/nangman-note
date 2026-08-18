import { create } from 'zustand';
import { noteApi } from '../api/noteApi';

let latestLoadRequestSeq = 0;

const OFFLINE_NOTE_PREFIX = 'transnote_offline_note_';

interface OfflineNoteBackup {
  content: string;
  savedAt: number;
}

function getOfflineKey(meetingId: string) {
  return `${OFFLINE_NOTE_PREFIX}${meetingId}`;
}

function saveToLocalStorage(meetingId: string, content: string) {
  try {
    const backup: OfflineNoteBackup = { content, savedAt: Date.now() };
    localStorage.setItem(getOfflineKey(meetingId), JSON.stringify(backup));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadFromLocalStorage(meetingId: string): OfflineNoteBackup | null {
  try {
    const raw = localStorage.getItem(getOfflineKey(meetingId));
    if (raw === null) return null;

    // 신형 포맷 (JSON)
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as OfflineNoteBackup).content === 'string'
      ) {
        return {
          content: (parsed as OfflineNoteBackup).content,
          savedAt:
            typeof (parsed as OfflineNoteBackup).savedAt === 'number'
              ? (parsed as OfflineNoteBackup).savedAt
              : 0,
        };
      }
    } catch {
      // 구형 포맷 (plain string) 폴백
    }
    return { content: raw, savedAt: 0 };
  } catch {
    return null;
  }
}

function clearLocalStorage(meetingId: string) {
  try {
    localStorage.removeItem(getOfflineKey(meetingId));
  } catch {
    // silently ignore
  }
}

interface NoteState {
  noteContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  /** 마지막 loadNote가 오프라인 백업에서 복원됐는지 여부 */
  restoredFromBackup: boolean;
  setContent: (content: string) => void;
  saveNote: (meetingId: string) => Promise<boolean>;
  loadNote: (meetingId: string) => Promise<string>;
  clearNote: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  noteContent: '',
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  error: null,
  restoredFromBackup: false,

  setContent: (content) => {
    set({ noteContent: content, isDirty: true });
  },

  saveNote: async (meetingId) => {
    const { noteContent } = get();
    set({ isSaving: true, error: null });

    try {
      await noteApi.save(meetingId, noteContent);
      // On successful save, clear any offline cache for this meeting
      clearLocalStorage(meetingId);
      set({
        isSaving: false,
        isDirty: false,
        lastSaved: new Date(),
        restoredFromBackup: false,
      });
      return true;
    } catch (error) {
      // Save to localStorage as fallback when API fails
      saveToLocalStorage(meetingId, noteContent);
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save note',
      });
      return false;
    }
  },

  loadNote: async (meetingId) => {
    const requestSeq = ++latestLoadRequestSeq;
    const backup = loadFromLocalStorage(meetingId);

    try {
      set({ error: null, restoredFromBackup: false });
      const note = await noteApi.get(meetingId);

      // 오프라인 백업이 서버 버전보다 최신이고 내용이 다르면 백업을 복원한다.
      // (저장 실패 후 탭을 닫았다가 재접속한 케이스 — 이전에는 백업이
      // write-only라서 복원 없이 조용히 사장됐다)
      const serverUpdatedAt = note.updatedAt
        ? new Date(note.updatedAt).getTime()
        : 0;
      const shouldRestoreBackup =
        backup !== null &&
        backup.content.trim().length > 0 &&
        backup.content !== note.content &&
        backup.savedAt > serverUpdatedAt;

      const effectiveContent = shouldRestoreBackup
        ? backup.content
        : note.content;

      set((state) => {
        if (requestSeq !== latestLoadRequestSeq) {
          return state;
        }
        // 로드 중 사용자가 이미 타이핑을 시작했다면(dirty) 서버 값으로
        // 덮어쓰지 않는다 — 진행 중 입력이 유실되고 가드가 풀리는 회귀 방지.
        if (state.isDirty) {
          return state;
        }
        return {
          ...state,
          noteContent: effectiveContent,
          // 복원한 백업은 아직 서버에 없으므로 dirty로 표시해 자동 저장 유도
          isDirty: shouldRestoreBackup,
          restoredFromBackup: shouldRestoreBackup,
        };
      });
      return effectiveContent;
    } catch (error) {
      // 서버 로드 실패 시에도 백업이 있으면 복원 (완전 유실 방지)
      if (backup !== null && backup.content.trim().length > 0) {
        set((state) => {
          if (requestSeq !== latestLoadRequestSeq) {
            return state;
          }
          if (state.isDirty) {
            return state;
          }
          return {
            ...state,
            noteContent: backup.content,
            isDirty: true,
            restoredFromBackup: true,
            error: null,
          };
        });
        return backup.content;
      }

      set((state) => {
        if (requestSeq !== latestLoadRequestSeq) {
          return state;
        }
        return {
          ...state,
          error: error instanceof Error ? error.message : 'Failed to load note',
        };
      });
      return '';
    }
  },

  clearNote: () => {
    set({
      noteContent: '',
      isDirty: false,
      lastSaved: null,
      error: null,
      restoredFromBackup: false,
    });
  },
}));
