import { create } from 'zustand';
import { noteApi } from '../api/noteApi';

interface NoteState {
  noteContent: string;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  setContent: (content: string) => void;
  saveNote: (meetingId: string) => Promise<void>;
  loadNote: (meetingId: string) => Promise<void>;
  clearNote: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  noteContent: '',
  isSaving: false,
  lastSaved: null,
  error: null,

  setContent: (content) => {
    set({ noteContent: content });
  },

  saveNote: async (meetingId) => {
    const { noteContent } = get();
    set({ isSaving: true, error: null });

    try {
      await noteApi.save(meetingId, noteContent);
      set({ isSaving: false, lastSaved: new Date() });
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save note',
      });
    }
  },

  loadNote: async (meetingId) => {
    try {
      set({ error: null });
      const note = await noteApi.get(meetingId);
      set({ noteContent: note.content });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load note',
      });
    }
  },

  clearNote: () => {
    set({ noteContent: '', lastSaved: null, error: null });
  },
}));
