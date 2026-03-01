import { create } from 'zustand';
import type { RealtimeTranscriptPayload } from '../types/transcription.types';

/** 확정된 전사 세그먼트 */
export interface FinalSegment {
  resultId: string;
  text: string;
  translatedText?: string;
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
}

/** 진행중 partial 세그먼트 (최신 1개만 유지) */
export interface PartialSegment {
  resultId: string;
  text: string;
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
}

interface TranscriptionState {
  /** 확정된 전사 세그먼트 목록 (시간순) */
  segments: FinalSegment[];
  /** 현재 진행중인 partial 세그먼트 (null이면 없음) */
  partial: PartialSegment | null;
  isConnected: boolean;
  isTranscriptExpanded: boolean;
  hasActiveSession: boolean;
  error: string | null;

  // Actions
  handlePayload: (payload: RealtimeTranscriptPayload) => void;
  clearTranscripts: () => void;
  toggleExpanded: () => void;
  setConnected: (connected: boolean) => void;
  setHasActiveSession: (active: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  segments: [],
  partial: null,
  isConnected: false,
  isTranscriptExpanded: false,
  hasActiveSession: false,
  error: null,

  handlePayload: (payload: RealtimeTranscriptPayload) => {
    if (payload.type === 'partial') {
      set({
        partial: {
          resultId: payload.resultId,
          text: payload.text,
          startTime: payload.startTime,
          endTime: payload.endTime,
          detectedLanguage: payload.detectedLanguage,
        },
      });
    } else {
      // final: partial을 클리어하고 segments에 추가
      set((state) => ({
        partial: null,
        segments: [
          ...state.segments,
          {
            resultId: payload.resultId,
            text: payload.text,
            translatedText: payload.translatedText,
            startTime: payload.startTime,
            endTime: payload.endTime,
            detectedLanguage: payload.detectedLanguage,
          },
        ],
      }));
    }
  },

  clearTranscripts: () => {
    set({ segments: [], partial: null });
  },

  toggleExpanded: () => {
    set((state) => ({
      isTranscriptExpanded: !state.isTranscriptExpanded,
    }));
  },

  setConnected: (connected) => {
    set({ isConnected: connected });
  },

  setHasActiveSession: (active) => {
    set({ hasActiveSession: active });
  },

  setError: (error) => {
    set({ error });
  },
}));