'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  cleanupAudioStreamingRuntime,
  drainPendingChunks,
  handleAudioAckResponse,
  handleAudioChunk,
  markStoppedByGuard,
  notifyAudioStreamingFallback,
  preloadAudioWorkletModule,
  requestRealtimeSessionStop,
  startAudioStreamingRuntime,
  useAudioStreamingRuntimeRefs,
  type AudioStreamingState,
  type StartStreamingOptions,
} from '../lib/audioStreamingRuntime';
import type { AudioAckResponse } from './audioStreamingPolicy';

export type { AudioStreamingState } from '../lib/audioStreamingRuntime';

interface UseAudioStreamingReturn {
  state: AudioStreamingState;
  error: string | null;
  startStreaming: (
    stream: MediaStream,
    socket: Socket,
    options?: StartStreamingOptions,
  ) => Promise<void>;
  stopStreaming: () => void;
}

export function useAudioStreaming(): UseAudioStreamingReturn {
  const [state, setState] = useState<AudioStreamingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const refs = useAudioStreamingRuntimeRefs();
  const startingRef = useRef(false);
  const startGenerationRef = useRef(0);

  const notifyFallbackToBatch = useCallback((reason?: string) => {
    notifyAudioStreamingFallback(refs, reason);
  }, [refs]);

  const requestSessionStop = useCallback(() => {
    requestRealtimeSessionStop(refs.socketRef.current);
  }, [refs]);

  const cleanup = useCallback(() => {
    cleanupAudioStreamingRuntime(refs);
  }, [refs]);

  const stopForRealtimeInstability = useCallback(
    (message: string, reason: string) => {
      if (!markStoppedByGuard(refs)) return;
      requestSessionStop();
      notifyFallbackToBatch(reason);
      cleanup();
      setState('stopped');
      setError(message);
    },
    [cleanup, notifyFallbackToBatch, refs, requestSessionStop],
  );

  const handleAck = useCallback(
    (ackId: number, ack?: AudioAckResponse) => {
      // 자기 참조 클로저: ack 처리 후 버퍼된 청크를 이어 전송하고,
      // 그 청크들의 ack도 동일한 파이프라인으로 처리한다.
      const processAck = (nextAckId: number, nextAck?: AudioAckResponse) => {
        handleAudioAckResponse({
          ackId: nextAckId,
          ack: nextAck,
          refs,
          requestSessionStop,
          notifyFallbackToBatch,
          cleanup,
          setState,
          setError,
          stopForRealtimeInstability,
        });
        // ack 처리로 in-flight 슬롯이 비었으면 버퍼된 청크를 이어서 전송
        drainPendingChunks({
          refs,
          stopForRealtimeInstability,
          onAck: processAck,
        });
      };
      processAck(ackId, ack);
    },
    [
      cleanup,
      notifyFallbackToBatch,
      refs,
      requestSessionStop,
      stopForRealtimeInstability,
    ],
  );

  const handleChunk = useCallback(
    (chunk: ArrayBuffer) => {
      handleAudioChunk({
        chunk,
        refs,
        stopForRealtimeInstability,
        onAck: handleAck,
      });
    },
    [handleAck, refs, stopForRealtimeInstability],
  );

  const startStreaming = useCallback(
    async (
      stream: MediaStream,
      socket: Socket,
      options?: StartStreamingOptions,
    ) => {
      if (startingRef.current || refs.audioContextRef.current) return;

      const generation = ++startGenerationRef.current;
      startingRef.current = true;
      setError(null);

      try {
        await startAudioStreamingRuntime({
          stream,
          socket,
          options,
          refs,
          handleChunk,
        });
        if (generation !== startGenerationRef.current) {
          cleanup();
          return;
        }
        setState('streaming');
      } catch (err) {
        if (generation !== startGenerationRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : '오디오 스트리밍을 시작할 수 없습니다';
        setError(message);
        setState('error');
        cleanup();
      } finally {
        if (generation === startGenerationRef.current) {
          startingRef.current = false;
        }
      }
    },
    [cleanup, handleChunk, refs],
  );

  const stopStreaming = useCallback(() => {
    startGenerationRef.current += 1;
    startingRef.current = false;
    setState('stopping');
    requestSessionStop();
    cleanup();
    setState('stopped');
  }, [cleanup, requestSessionStop]);

  useEffect(() => {
    preloadAudioWorkletModule();
  }, []);

  useEffect(() => {
    return () => {
      startGenerationRef.current += 1;
      startingRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    error,
    startStreaming,
    stopStreaming,
  };
}
