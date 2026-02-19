import { create } from 'zustand';
import type { TranscriptSegment } from '../types/transcription.types';

interface TranscriptionState {
  transcripts: TranscriptSegment[];
  isConnected: boolean;
  isTranscriptExpanded: boolean;
  error: string | null;

  // Actions
  addSegment: (segment: TranscriptSegment) => void;
  clearTranscripts: () => void;
  toggleExpanded: () => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  transcripts: [],
  isConnected: false,
  isTranscriptExpanded: false,
  error: null,

  addSegment: (segment) => {
    set((state) => ({
      transcripts: [...state.transcripts, segment],
    }));
  },

  clearTranscripts: () => {
    set({ transcripts: [] });
  },

  toggleExpanded: () => {
    set((state) => ({
      isTranscriptExpanded: !state.isTranscriptExpanded,
    }));
  },

  setConnected: (connected) => {
    set({ isConnected: connected });
  },

  setError: (error) => {
    set({ error });
  },
}));
