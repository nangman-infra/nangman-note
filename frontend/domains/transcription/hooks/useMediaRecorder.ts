'use client';

import { useCallback, useRef, useState } from 'react';
import {
  saveChunk,
  assembleSessionBlobs,
  clearChunks,
  type RecordedSessionBlob,
} from '@/lib/db/audioChunkDB';

const CHUNK_INTERVAL_MS = 10_000; // 10초 간격 청크

const PREFERRED_MIME_TYPE = 'audio/webm;codecs=opus';

export type RecorderState = 'idle' | 'recording' | 'stopping';

export type { RecordedSessionBlob } from '@/lib/db/audioChunkDB';

interface UseMediaRecorderReturn {
  state: RecorderState;
  chunkCount: number;
  error: string | null;
  startRecording: (stream: MediaStream, meetingId: string) => void;
  /**
   * 녹음을 중지하고 IndexedDB에 저장된 모든 세션의 오디오를 반환합니다.
   * 새로고침·마이크 교체 등으로 여러 세션이 존재하면 세션별 블롭이 각각 반환됩니다.
   */
  stopRecording: () => Promise<RecordedSessionBlob[]>;
  /** 녹음 중이 아니어도 IndexedDB에서 세션 블롭을 조립합니다 (재시도용) */
  assembleSessions: () => Promise<RecordedSessionBlob[]>;
  cleanupChunks: () => Promise<void>;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const meetingIdRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const sessionStartedAtRef = useRef<number>(0);
  const chunkIndexRef = useRef<number>(0);
  /** 진행 중인 IndexedDB 쓰기 — stop 시 확정적으로 대기해 마지막 청크 유실 방지 */
  const pendingSavesRef = useRef<Set<Promise<void>>>(new Set());
  const resolveStopRef = useRef<
    ((sessions: RecordedSessionBlob[]) => void) | null
  >(null);

  const assembleSessions = useCallback(async (): Promise<
    RecordedSessionBlob[]
  > => {
    if (!meetingIdRef.current) return [];
    return assembleSessionBlobs(meetingIdRef.current);
  }, []);

  const startRecording = useCallback(
    (stream: MediaStream, meetingId: string) => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        return;
      }

      setError(null);
      meetingIdRef.current = meetingId;

      // 녹음 세션마다 고유 ID를 부여한다.
      // MediaRecorder 인스턴스마다 독립된 WebM 파일이 생성되므로,
      // 같은 인덱스 공간을 공유하면 새로고침/재시작 시 기존 청크를
      // 덮어써 오디오가 손상된다 (세션 분리로 원천 차단).
      const sessionId = createSessionId();
      sessionIdRef.current = sessionId;
      sessionStartedAtRef.current = Date.now();
      chunkIndexRef.current = 0;

      const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)
        ? PREFERRED_MIME_TYPE
        : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;

        const currentIndex = chunkIndexRef.current;
        chunkIndexRef.current += 1;

        const savePromise = saveChunk(
          meetingIdRef.current,
          sessionIdRef.current,
          currentIndex,
          sessionStartedAtRef.current,
          event.data,
        )
          .then(() => {
            setChunkCount((prev) => prev + 1);
          })
          .catch((err: unknown) => {
            const isQuotaError =
              err instanceof DOMException && err.name === 'QuotaExceededError';
            if (isQuotaError) {
              setError(
                '브라우저 저장 공간이 부족해 오디오 청크를 저장하지 못했습니다. 다른 사이트 데이터를 정리하거나 회의를 종료해주세요.',
              );
              return;
            }
            setError(
              err instanceof Error
                ? `청크 저장 실패: ${err.message}`
                : '오디오 청크를 IndexedDB에 저장하지 못했습니다.',
            );
          });

        pendingSavesRef.current.add(savePromise);
        void savePromise.finally(() => {
          pendingSavesRef.current.delete(savePromise);
        });
      };

      recorder.onerror = () => {
        setError('마이크 녹음 중 오류가 발생했습니다.');
        setState('idle');
      };

      recorder.onstop = async () => {
        // 마지막 ondataavailable의 IndexedDB 쓰기가 끝날 때까지 확정적으로 대기
        // (고정 딜레이 휴리스틱은 저사양 기기에서 마지막 청크를 유실할 수 있음)
        await Promise.allSettled(Array.from(pendingSavesRef.current));

        const sessions = await assembleSessionBlobs(meetingIdRef.current);
        setState('idle');

        if (resolveStopRef.current) {
          resolveStopRef.current(sessions);
          resolveStopRef.current = null;
        }
      };

      recorderRef.current = recorder;
      recorder.start(CHUNK_INTERVAL_MS);
      setState('recording');
    },
    [],
  );

  const stopRecording = useCallback(async (): Promise<
    RecordedSessionBlob[]
  > => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setState('idle');
      await Promise.allSettled(Array.from(pendingSavesRef.current));
      return assembleSessions();
    }

    setState('stopping');

    return new Promise<RecordedSessionBlob[]>((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, [assembleSessions]);

  const cleanupChunks = useCallback(async () => {
    const meetingId = meetingIdRef.current;
    if (meetingId) {
      await clearChunks(meetingId);
    }
    setChunkCount(0);
    setState('idle');
    recorderRef.current = null;
  }, []);

  return {
    state,
    chunkCount,
    error,
    startRecording,
    stopRecording,
    assembleSessions,
    cleanupChunks,
  };
}
