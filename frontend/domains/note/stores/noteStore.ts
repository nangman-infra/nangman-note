import { create } from 'zustand';
import { noteApi } from '../api/noteApi';

let latestLoadRequestSeq = 0;

const OFFLINE_NOTE_PREFIX = 'transnote_offline_note_';

function getOfflineKey(meetingId: string) {
  return `${OFFLINE_NOTE_PREFIX}${meetingId}`;
}

function saveToLocalStorage(meetingId: string, content: string) {
  try {
    localStorage.setItem(getOfflineKey(meetingId), content);
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadFromLocalStorage(meetingId: string): string | null {
  try {
    return localStorage.getItem(getOfflineKey(meetingId));
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

  setContent: (content) => {
    set({ noteContent: content, isDirty: true });
  },

  saveNote: async (meetingId) => {
    const { noteContent } = get();
    set({ isSaving: true, error: null });

    // Check if there's a cached version from a previous offline save and sync it first
    const cached = loadFromLocalStorage(meetingId);

    try {
      await noteApi.save(meetingId, noteContent);
      // On successful save, clear any offline cache for this meeting
      if (cached !== null) {
        clearLocalStorage(meetingId);
      }
      set({ isSaving: false, isDirty: false, lastSaved: new Date() });
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
    try {
      set({ error: null });
      const note = await noteApi.get(meetingId);
      set((state) => {
        if (requestSeq !== latestLoadRequestSeq) {
          return state;
        }
        return { ...state, noteContent: note.content };
      });
      return note.content;
    } catch (error) {
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
    set({ noteContent: '', isDirty: false, lastSaved: null, error: null });
  },
}));
