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

// 100ms 청크 기준 6개면 약 600ms RTT까지 실시간성을 유지하며 버퍼링할 수 있음.
const MAX_IN_FLIGHT_ACKS = 6;
const ACK_TIMEOUT_MS = 1200;
const MAX_CONSECUTIVE_TIMEOUTS = 5;
const MAX_CONSECUTIVE_BACKPRESSURE = 8;
const MAX_SATURATION_MS = 2500;

export function useAudioStreaming(): UseAudioStreamingReturn {
  const [state, setState] = useState<AudioStreamingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef<StartStreamingOptions | undefined>(undefined);
  const fallbackNotifiedRef = useRef(false);
  const inFlightAckCountRef = useRef(0);
  const nextAckIdRef = useRef(1);
  const ackTimeoutMapRef = useRef<Map<number, number>>(new Map());
  const consecutiveTimeoutRef = useRef(0);
  const consecutiveBackpressureRef = useRef(0);
  const saturationStartAtRef = useRef<number | null>(null);
  const stoppedByGuardRef = useRef(false);

  const notifyFallbackToBatch = useCallback((reason?: string) => {
    if (fallbackNotifiedRef.current) return;
    fallbackNotifiedRef.current = true;
    optionsRef.current?.onFallbackToBatch?.({ reason });
  }, []);

  const requestRealtimeSessionStop = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('transcript:stop', () => undefined);
  }, []);

  const clearAckTrackers = useCallback(() => {
    ackTimeoutMapRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    ackTimeoutMapRef.current.clear();
    inFlightAckCountRef.current = 0;
    consecutiveTimeoutRef.current = 0;
    consecutiveBackpressureRef.current = 0;
    saturationStartAtRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    clearAckTrackers();

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
  }, [clearAckTrackers]);

  const stopForRealtimeInstability = useCallback(
    (message: string, reason: string) => {
      if (stoppedByGuardRef.current) return;
      stoppedByGuardRef.current = true;
      requestRealtimeSessionStop();
      notifyFallbackToBatch(reason);
      cleanup();
      setState('stopped');
      setError(message);
    },
    [cleanup, notifyFallbackToBatch, requestRealtimeSessionStop],
  );

  const handleChunk = useCallback(
    (chunk: ArrayBuffer) => {
      if (!chunk || chunk.byteLength === 0) return;

      const socket = socketRef.current;
      if (!socket?.connected) {
        return;
      }

      if (inFlightAckCountRef.current >= MAX_IN_FLIGHT_ACKS) {
        const now = Date.now();
        if (saturationStartAtRef.current === null) {
          saturationStartAtRef.current = now;
          return;
        }

        if (now - saturationStartAtRef.current >= MAX_SATURATION_MS) {
          stopForRealtimeInstability(
            '네트워크 지연으로 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
            'client-network-saturation',
          );
        }
        return;
      }

      saturationStartAtRef.current = null;

      const ackId = nextAckIdRef.current++;
      inFlightAckCountRef.current += 1;

      const timeoutId = window.setTimeout(() => {
        const trackedTimer = ackTimeoutMapRef.current.get(ackId);
        if (trackedTimer === undefined) {
          return;
        }
        ackTimeoutMapRef.current.delete(ackId);
        inFlightAckCountRef.current = Math.max(0, inFlightAckCountRef.current - 1);
        consecutiveTimeoutRef.current += 1;
        if (consecutiveTimeoutRef.current >= MAX_CONSECUTIVE_TIMEOUTS) {
          stopForRealtimeInstability(
            '응답 지연이 지속되어 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
            'client-ack-timeout',
          );
        }
      }, ACK_TIMEOUT_MS);

      ackTimeoutMapRef.current.set(ackId, timeoutId);

      socket.emit('audio', chunk, (ack?: AudioAckResponse) => {
        const timer = ackTimeoutMapRef.current.get(ackId);
        if (timer === undefined) {
          return;
        }
        window.clearTimeout(timer);
        ackTimeoutMapRef.current.delete(ackId);
        inFlightAckCountRef.current = Math.max(0, inFlightAckCountRef.current - 1);
        consecutiveTimeoutRef.current = 0;

        const response = ack ?? { ok: false, reason: 'ack-timeout' };
        if (response.ok) {
          consecutiveBackpressureRef.current = 0;
          return;
        }

        if (
          response.reason === 'realtime-capacity-exceeded' &&
          response.fallbackToBatch &&
          response.mode === 'batch'
        ) {
          requestRealtimeSessionStop();
          notifyFallbackToBatch(response.reason);
          cleanup();
          setState('stopped');
          setError('실시간 전사 용량 초과로 배치 모드로 전환되었습니다.');
          return;
        }

        if (response.reason === 'backpressure') {
          consecutiveBackpressureRef.current += 1;
          if (consecutiveBackpressureRef.current >= MAX_CONSECUTIVE_BACKPRESSURE) {
            stopForRealtimeInstability(
              '전사 서버 부하가 지속되어 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
              'client-backpressure',
            );
          } else {
            setError('전사 서버 처리 지연이 감지되었습니다. 네트워크 상태를 확인해주세요.');
          }
          return;
        }

        if (response.reason === 'chunk-too-large') {
          setError('오디오 청크가 커서 일부 구간 전송에 실패했습니다.');
          return;
        }

        setError(
          '실시간 전사 연결이 불안정합니다. 잠시 후 자동으로 복구되지 않으면 회의를 다시 시작해주세요.',
        );
      });
    },
    [cleanup, notifyFallbackToBatch, requestRealtimeSessionStop, stopForRealtimeInstability],
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
        stoppedByGuardRef.current = false;
        clearAckTrackers();

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
          handleChunk(pcmBuffer);
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
    [cleanup, clearAckTrackers, handleChunk],
  );

  const stopStreaming = useCallback(() => {
    setState('stopping');
    requestRealtimeSessionStop();
    cleanup();
    setState('stopped');
  }, [cleanup, requestRealtimeSessionStop]);

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
