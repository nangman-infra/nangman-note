'use client';

import { useCallback, useRef, useState } from 'react';
import { saveChunk, assembleBlob, clearChunks } from '@/lib/db/audioChunkDB';

const CHUNK_INTERVAL_MS = 10_000; // 10초 간격 청크

const PREFERRED_MIME_TYPE = 'audio/webm;codecs=opus';

export type RecorderState = 'idle' | 'recording' | 'stopping' | 'stopped';

interface UseMediaRecorderReturn {
  state: RecorderState;
  chunkCount: number;
  error: string | null;
  startRecording: (stream: MediaStream, meetingId: string) => void;
  stopRecording: () => Promise<Blob | null>;
  cleanupChunks: () => Promise<void>;
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const meetingIdRef = useRef<string>('');
  const chunkIndexRef = useRef<number>(0);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const startRecording = useCallback(
    (stream: MediaStream, meetingId: string) => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        return;
      }

      setError(null);
      setChunkCount(0);
      meetingIdRef.current = meetingId;
      chunkIndexRef.current = 0;

      const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)
        ? PREFERRED_MIME_TYPE
        : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;

        const currentIndex = chunkIndexRef.current;
        chunkIndexRef.current += 1;

        try {
          await saveChunk(meetingIdRef.current, currentIndex, event.data);
          setChunkCount((prev) => prev + 1);
        } catch (err) {
          setError(
            err instanceof Error
              ? `청크 저장 실패: ${err.message}`
              : '오디오 청크를 IndexedDB에 저장하지 못했습니다.',
          );
        }
      };

      recorder.onerror = () => {
        setError('마이크 녹음 중 오류가 발생했습니다.');
        setState('stopped');
      };

      recorder.onstop = async () => {
        // stop 후 마지막 ondataavailable 이벤트가 실행된 뒤 onstop이 호출됨
        // 약간의 딜레이를 줘서 마지막 청크 저장이 완료되도록 함
        await new Promise((r) => setTimeout(r, 200));

        const blob = await assembleBlob(meetingIdRef.current);
        setState('stopped');

        if (resolveStopRef.current) {
          resolveStopRef.current(blob);
          resolveStopRef.current = null;
        }
      };

      recorderRef.current = recorder;
      recorder.start(CHUNK_INTERVAL_MS);
      setState('recording');
    },
    [],
  );

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return assembleBlob(meetingIdRef.current);
    }

    setState('stopping');

    return new Promise<Blob | null>((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, []);

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
    cleanupChunks,
  };
}