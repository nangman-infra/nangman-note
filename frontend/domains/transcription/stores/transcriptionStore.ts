import { create } from 'zustand';
import type {
  RealtimeTranscriptContentPayload,
  RealtimeTranscriptPayload,
} from '../types/transcription.types';

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

function squashExcessivePatternRepeats(text: string): string {
  let next = text.trim();
  if (!next) return next;

  // "ok ok ok ok" 형태 반복 축약
  next = next.replace(/(\S+)(?:\s+\1){2,}/gu, '$1 $1');

  // "좋아요좋아요좋아요" 형태(공백 없는 반복)도 완화
  if (next.length <= 200) {
    next = next.replace(/(.{1,8}?)(?:\1){2,}/gu, '$1$1');
  }

  return next.trim();
}

function sanitizeTranscriptText(text: string): string {
  const collapsedPattern = squashExcessivePatternRepeats(text);
  return squashExcessiveTokenRepeats(collapsedPattern);
}

/** 확정된 전사 세그먼트 */
export interface FinalSegment {
  resultId: string;
  text: string;
  translatedText?: string;
  translationStatus?: 'pending' | 'done' | 'failed';
  startTime: number;
  endTime: number;
  detectedLanguage?: string;
  /** Speaker Diarization 라벨 (e.g. 'spk_0') */
  speakerLabel?: string;
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
  /**
   * 재연결 후 DB 세그먼트로 재동기화.
   * 단절 중 emit돼 놓친 final을 복구한다 (서버가 진실 원천).
   */
  syncSegmentsFromServer: (
    serverSegments: Array<{
      id: string;
      text: string;
      translatedText?: string;
      startTime: number;
      endTime: number;
      detectedLanguage?: string;
      speakerLabel?: string;
    }>,
  ) => void;
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
    if (payload.type === 'translation') {
      set((state) => ({
        ...state,
        segments: state.segments.map((segment) => {
          if (segment.resultId !== payload.resultId) {
            return segment;
          }
          return {
            ...segment,
            translatedText: payload.translatedText ?? segment.translatedText,
            translationStatus: payload.failed ? 'failed' : 'done',
          };
        }),
      }));
      return;
    }

    if (payload.type === 'partial') {
      const cleanedPartial = sanitizeTranscriptText(payload.text);
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
      const cleanedFinal = sanitizeTranscriptText(payload.text);
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

          const hasRecentDuplicate = state.segments
            .slice(-3)
            .some((segment) => {
              const isSameText =
                normalizeTextForCompare(segment.text) === normalizedFinal;
              const isNearTimestamp =
                Math.abs(segment.endTime - payload.endTime) < 2.5;
              return isSameText && isNearTimestamp;
            });
          if (hasRecentDuplicate) {
            return state.segments;
          }

          return [
            ...state.segments,
            {
              resultId: payload.resultId,
              text: cleanedFinal,
              translatedText: payload.translatedText,
              translationStatus: getTranslationStatus(payload),
              startTime: payload.startTime,
              endTime: payload.endTime,
              detectedLanguage: payload.detectedLanguage,
              speakerLabel: payload.speakerLabel,
            },
          ];
        })(),
      }));
    }
  },

  syncSegmentsFromServer: (serverSegments) => {
    set((state) => {
      if (serverSegments.length === 0) {
        return state;
      }

      const synced: FinalSegment[] = serverSegments
        .slice()
        .sort((a, b) => a.startTime - b.startTime)
        .map((segment) => ({
          resultId: `server-${segment.id}`,
          text: sanitizeTranscriptText(segment.text),
          translatedText: segment.translatedText,
          translationStatus: segment.translatedText
            ? ('done' as const)
            : undefined,
          startTime: segment.startTime,
          endTime: segment.endTime,
          detectedLanguage: segment.detectedLanguage,
          speakerLabel: segment.speakerLabel,
        }));

      // 아직 서버에 반영되지 않았을 수 있는 로컬 최신 세그먼트는 보존
      const maxServerEndTime = synced[synced.length - 1]?.endTime ?? 0;
      const localTail = state.segments.filter(
        (segment) => segment.endTime > maxServerEndTime + 0.5,
      );

      return {
        ...state,
        segments: [...synced, ...localTail],
      };
    });
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

function getTranslationStatus(
  payload: RealtimeTranscriptContentPayload,
): FinalSegment['translationStatus'] {
  if (payload.translationPending) return 'pending';
  if (payload.translatedText) return 'done';
  return undefined;
}
