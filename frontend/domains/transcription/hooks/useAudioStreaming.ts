'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export type AudioStreamingState =
  | 'idle'
  | 'streaming'
  | 'stopping'
  | 'stopped'
  | 'error';

interface AudioAckResponse {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
  fallbackToBatch?: boolean;
  mode?: 'batch';
}

interface StartStreamingOptions {
  onFallbackToBatch?: (payload?: { reason?: string }) => void;
}

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

const MAX_PENDING_AUDIO_BYTES = 2 * 1024 * 1024;
const ACK_TIMEOUT_MS = 1500;
const DEFAULT_RETRY_MS = 200;

export function useAudioStreaming(): UseAudioStreamingReturn {
  const [state, setState] = useState<AudioStreamingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef<StartStreamingOptions | undefined>(undefined);
  const fallbackNotifiedRef = useRef(false);

  const pendingQueueRef = useRef<ArrayBuffer[]>([]);
  const pendingBytesRef = useRef(0);
  const inFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const flushQueueRef = useRef<() => void>(() => undefined);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const dropHeadChunk = useCallback(() => {
    const chunk = pendingQueueRef.current.shift();
    if (!chunk) return;
    pendingBytesRef.current = Math.max(0, pendingBytesRef.current - chunk.byteLength);
  }, []);

  const clearQueue = useCallback(() => {
    pendingQueueRef.current = [];
    pendingBytesRef.current = 0;
    inFlightRef.current = false;
  }, []);

  const cleanup = useCallback(() => {
    clearRetryTimer();
    clearQueue();

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage('stop');
        workletNodeRef.current.disconnect();
      } catch {
        // no-op
      }
      workletNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // no-op
      }
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    socketRef.current = null;
    optionsRef.current = undefined;
    fallbackNotifiedRef.current = false;
  }, [clearQueue, clearRetryTimer]);

  const scheduleRetry = useCallback(
    (retryAfterMs: number, flushQueue: () => void) => {
      clearRetryTimer();
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        flushQueue();
      }, Math.max(50, retryAfterMs));
    },
    [clearRetryTimer],
  );

  const flushQueue = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    if (inFlightRef.current) return;
    if (pendingQueueRef.current.length === 0) return;

    const currentChunk = pendingQueueRef.current[0];
    inFlightRef.current = true;

    let settled = false;
    const finish = (response?: AudioAckResponse) => {
      if (settled) return;
      settled = true;
      inFlightRef.current = false;

      const ack = response ?? {
        ok: false,
        reason: 'ack-timeout',
        retryAfterMs: DEFAULT_RETRY_MS,
      };

      if (ack.ok) {
        dropHeadChunk();
        flushQueueRef.current();
        return;
      }

      const reason = ack.reason ?? 'unknown';
      if (reason === 'chunk-too-large') {
        dropHeadChunk();
        flushQueueRef.current();
        return;
      }

      if (
        reason === 'realtime-capacity-exceeded' &&
        ack.fallbackToBatch &&
        ack.mode === 'batch'
      ) {
        cleanup();
        setState('stopped');
        setError('실시간 전사 용량 초과로 배치 모드로 전환되었습니다.');
        if (!fallbackNotifiedRef.current) {
          fallbackNotifiedRef.current = true;
          optionsRef.current?.onFallbackToBatch?.({ reason });
        }
        return;
      }

      const retryAfter = ack.retryAfterMs ?? DEFAULT_RETRY_MS;
      scheduleRetry(retryAfter, flushQueueRef.current);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        reason: 'ack-timeout',
        retryAfterMs: DEFAULT_RETRY_MS,
      });
    }, ACK_TIMEOUT_MS);

    socket.emit('audio', currentChunk, (ack?: AudioAckResponse) => {
      window.clearTimeout(timeoutId);
      finish(ack);
    });
  }, [cleanup, dropHeadChunk, scheduleRetry]);

  useEffect(() => {
    flushQueueRef.current = flushQueue;
  }, [flushQueue]);

  const enqueueChunk = useCallback(
    (chunk: ArrayBuffer) => {
      if (chunk.byteLength === 0) return;

      while (
        pendingBytesRef.current + chunk.byteLength > MAX_PENDING_AUDIO_BYTES &&
        pendingQueueRef.current.length > 0
      ) {
        dropHeadChunk();
      }

      if (pendingBytesRef.current + chunk.byteLength > MAX_PENDING_AUDIO_BYTES) {
        setError('오디오 처리량이 높아 일부 구간이 생략되었습니다.');
        return;
      }

      pendingQueueRef.current.push(chunk);
      pendingBytesRef.current += chunk.byteLength;
      flushQueueRef.current();
    },
    [dropHeadChunk],
  );

  const startStreaming = useCallback(
    async (
      stream: MediaStream,
      socket: Socket,
      options?: StartStreamingOptions,
    ) => {
      setError(null);

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        socketRef.current = socket;
        optionsRef.current = options;
        fallbackNotifiedRef.current = false;
        clearRetryTimer();
        clearQueue();

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        await audioContext.audioWorklet.addModule(
          '/audio-worklet/pcm-processor.js',
        );

        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const workletNode = new AudioWorkletNode(
          audioContext,
          'pcm-processor',
        );
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event: MessageEvent) => {
          const pcmBuffer: ArrayBuffer = event.data;
          if (!pcmBuffer || pcmBuffer.byteLength === 0) return;
          enqueueChunk(pcmBuffer);
        };

        source.connect(workletNode);

        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        workletNode.connect(silentGain);
        silentGain.connect(audioContext.destination);

        setState('streaming');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : '오디오 스트리밍을 시작할 수 없습니다';
        setError(message);
        setState('error');
        cleanup();
      }
    },
    [cleanup, clearQueue, clearRetryTimer, enqueueChunk],
  );

  const stopStreaming = useCallback(() => {
    setState('stopping');
    cleanup();
    setState('stopped');
  }, [cleanup]);

  useEffect(() => {
    return () => {
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
