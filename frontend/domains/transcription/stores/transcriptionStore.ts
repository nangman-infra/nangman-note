import { create } from 'zustand';
import type { RealtimeTranscriptPayload } from '../types/transcription.types';

function normalizeTextForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function squashExcessiveTokenRepeats(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text.trim();

  const compact: string[] = [];
  let lastToken = '';
  let repeat = 0;

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (normalized === lastToken) {
      repeat += 1;
    } else {
      lastToken = normalized;
      repeat = 1;
    }

    // 동일 토큰 연속 반복은 최대 2개까지만 유지
    if (repeat <= 2) {
      compact.push(token);
    }
  }

  return compact.join(' ').trim();
}

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
      const cleanedPartial = squashExcessiveTokenRepeats(payload.text);
      set((state) => {
        if (
          state.partial &&
          state.partial.resultId === payload.resultId &&
          normalizeTextForCompare(state.partial.text) ===
            normalizeTextForCompare(cleanedPartial)
        ) {
          return state;
        }

        return {
          ...state,
          partial: {
            resultId: payload.resultId,
            text: cleanedPartial,
            startTime: payload.startTime,
            endTime: payload.endTime,
            detectedLanguage: payload.detectedLanguage,
          },
        };
      });
    } else {
      const cleanedFinal = squashExcessiveTokenRepeats(payload.text);
      const normalizedFinal = normalizeTextForCompare(cleanedFinal);

      // final: partial을 클리어하고 segments에 추가
      set((state) => ({
        ...state,
        partial: null,
        segments: (() => {
          if (!normalizedFinal) {
            return state.segments;
          }

          // 1) ResultId 중복 final 방지
          if (state.segments.some((segment) => segment.resultId === payload.resultId)) {
            return state.segments;
          }

          // 2) 인접 구간 중복 텍스트 방지
          const last = state.segments[state.segments.length - 1];
          if (last) {
            const isSameText =
              normalizeTextForCompare(last.text) === normalizedFinal;
            const isNearTimestamp = Math.abs(last.endTime - payload.endTime) < 0.8;
            if (isSameText && isNearTimestamp) {
              return state.segments;
            }
          }

          return [
            ...state.segments,
            {
              resultId: payload.resultId,
              text: cleanedFinal,
              translatedText: payload.translatedText,
              startTime: payload.startTime,
              endTime: payload.endTime,
              detectedLanguage: payload.detectedLanguage,
            },
          ];
        })(),
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
