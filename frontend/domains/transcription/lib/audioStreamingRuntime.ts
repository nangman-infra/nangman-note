import { useMemo, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import {
  AUDIO_STREAMING_LIMITS,
  getAckErrorMessage,
  isCapacityFallbackAck,
  shouldFallbackForSaturation,
  type AudioAckResponse,
} from '../hooks/audioStreamingPolicy';

export type AudioStreamingState =
  | 'idle'
  | 'streaming'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface StartStreamingOptions {
  onFallbackToBatch?: (payload?: { reason?: string }) => void;
}

export interface AudioStreamingRuntimeRefs {
  audioContextRef: MutableRefObject<AudioContext | null>;
  workletNodeRef: MutableRefObject<AudioWorkletNode | null>;
  sourceNodeRef: MutableRefObject<MediaStreamAudioSourceNode | null>;
  socketRef: MutableRefObject<Socket | null>;
  optionsRef: MutableRefObject<StartStreamingOptions | undefined>;
  fallbackNotifiedRef: MutableRefObject<boolean>;
  inFlightAckCountRef: MutableRefObject<number>;
  nextAckIdRef: MutableRefObject<number>;
  ackTimeoutMapRef: MutableRefObject<Map<number, number>>;
  consecutiveTimeoutRef: MutableRefObject<number>;
  consecutiveBackpressureRef: MutableRefObject<number>;
  saturationStartAtRef: MutableRefObject<number | null>;
  stoppedByGuardRef: MutableRefObject<boolean>;
  lastTransportNoticeAtRef: MutableRefObject<number | null>;
}

export function useAudioStreamingRuntimeRefs(): AudioStreamingRuntimeRefs {
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
  const lastTransportNoticeAtRef = useRef<number | null>(null);

  return useMemo(
    () => ({
      audioContextRef,
      workletNodeRef,
      sourceNodeRef,
      socketRef,
      optionsRef,
      fallbackNotifiedRef,
      inFlightAckCountRef,
      nextAckIdRef,
      ackTimeoutMapRef,
      consecutiveTimeoutRef,
      consecutiveBackpressureRef,
      saturationStartAtRef,
      stoppedByGuardRef,
      lastTransportNoticeAtRef,
    }),
    [],
  );
}

export function requestRealtimeSessionStop(socket: Socket | null) {
  if (!socket?.connected) return;
  socket.emit('transcript:stop', () => undefined);
}

export function notifyAudioStreamingFallback(
  refs: AudioStreamingRuntimeRefs,
  reason?: string,
) {
  if (refs.fallbackNotifiedRef.current) return;
  refs.fallbackNotifiedRef.current = true;
  refs.optionsRef.current?.onFallbackToBatch?.({ reason });
}

export function markStoppedByGuard(refs: AudioStreamingRuntimeRefs): boolean {
  if (refs.stoppedByGuardRef.current) return false;
  refs.stoppedByGuardRef.current = true;
  return true;
}

export function clearAudioAckTrackers(refs: AudioStreamingRuntimeRefs) {
  refs.ackTimeoutMapRef.current.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  refs.ackTimeoutMapRef.current.clear();
  refs.inFlightAckCountRef.current = 0;
  refs.consecutiveTimeoutRef.current = 0;
  refs.consecutiveBackpressureRef.current = 0;
  refs.saturationStartAtRef.current = null;
}

export function cleanupAudioStreamingRuntime(refs: AudioStreamingRuntimeRefs) {
  clearAudioAckTrackers(refs);
  stopWorkletNode(refs);
  disconnectSourceNode(refs);
  closeAudioContext(refs);
  refs.socketRef.current = null;
  refs.optionsRef.current = undefined;
  refs.fallbackNotifiedRef.current = false;
  refs.lastTransportNoticeAtRef.current = null;
}

export async function startAudioStreamingRuntime({
  stream,
  socket,
  options,
  refs,
  handleChunk,
}: {
  stream: MediaStream;
  socket: Socket;
  options?: StartStreamingOptions;
  refs: AudioStreamingRuntimeRefs;
  handleChunk: (chunk: ArrayBuffer) => void;
}) {
  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  refs.audioContextRef.current = audioContext;
  refs.socketRef.current = socket;
  refs.optionsRef.current = options;
  refs.fallbackNotifiedRef.current = false;
  refs.stoppedByGuardRef.current = false;
  refs.lastTransportNoticeAtRef.current = null;
  clearAudioAckTrackers(refs);

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  await audioContext.audioWorklet.addModule('/audio-worklet/pcm-processor.js');
  const source = audioContext.createMediaStreamSource(stream);
  refs.sourceNodeRef.current = source;

  const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
  refs.workletNodeRef.current = workletNode;
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
}

export function handleAudioChunk({
  chunk,
  refs,
  stopForRealtimeInstability,
  onAck,
}: {
  chunk: ArrayBuffer;
  refs: AudioStreamingRuntimeRefs;
  stopForRealtimeInstability: (message: string, reason: string) => void;
  onAck: (ackId: number, ack?: AudioAckResponse) => void;
}) {
  if (!chunk || chunk.byteLength === 0) return;
  const socket = refs.socketRef.current;
  if (!socket?.connected) return;

  if (refs.inFlightAckCountRef.current >= AUDIO_STREAMING_LIMITS.MAX_IN_FLIGHT_ACKS) {
    handleSaturatedAudioQueue({ refs, stopForRealtimeInstability });
    return;
  }

  refs.saturationStartAtRef.current = null;
  const ackId = refs.nextAckIdRef.current++;
  refs.inFlightAckCountRef.current += 1;
  const timeoutId = createAudioAckTimeout({
    ackId,
    refs,
    stopForRealtimeInstability,
  });

  refs.ackTimeoutMapRef.current.set(ackId, timeoutId);
  socket.emit('audio', new Uint8Array(chunk), (ack?: AudioAckResponse) => {
    onAck(ackId, ack);
  });
}

export function handleAudioAckResponse({
  ackId,
  ack,
  refs,
  requestSessionStop,
  notifyFallbackToBatch,
  cleanup,
  setState,
  setError,
  stopForRealtimeInstability,
}: {
  ackId: number;
  ack?: AudioAckResponse;
  refs: AudioStreamingRuntimeRefs;
  requestSessionStop: () => void;
  notifyFallbackToBatch: (reason?: string) => void;
  cleanup: () => void;
  setState: Dispatch<SetStateAction<AudioStreamingState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  stopForRealtimeInstability: (message: string, reason: string) => void;
}) {
  const timer = refs.ackTimeoutMapRef.current.get(ackId);
  if (timer === undefined) return;

  window.clearTimeout(timer);
  refs.ackTimeoutMapRef.current.delete(ackId);
  refs.inFlightAckCountRef.current = Math.max(
    0,
    refs.inFlightAckCountRef.current - 1,
  );
  refs.consecutiveTimeoutRef.current = 0;

  const response = ack ?? { ok: false, reason: 'ack-timeout' };
  if (response.ok) {
    refs.consecutiveBackpressureRef.current = 0;
    setError(null);
    return;
  }

  if (isCapacityFallbackAck(response)) {
    requestSessionStop();
    notifyFallbackToBatch(response.reason);
    cleanup();
    setState('stopped');
    setError('실시간 전사 용량 초과로 배치 모드로 전환되었습니다.');
    return;
  }

  if (response.reason === 'backpressure') {
    refs.consecutiveBackpressureRef.current += 1;
  }

  const ackError = getAckErrorMessage(
    response,
    refs.consecutiveBackpressureRef.current,
  );

  if (ackError.kind === 'fallback') {
    stopForRealtimeInstability(ackError.message, ackError.reason);
    return;
  }

  if (response.reason !== 'backpressure') {
    refs.consecutiveBackpressureRef.current = 0;
  }
  setError(ackError.message);
}

export function preloadAudioWorkletModule() {
  const head = document.head;
  const existing = head.querySelector<HTMLLinkElement>(
    'link[data-audio-worklet-preload="true"]',
  );
  if (existing) return;

  const preload = document.createElement('link');
  preload.rel = 'modulepreload';
  preload.href = '/audio-worklet/pcm-processor.js';
  preload.setAttribute('data-audio-worklet-preload', 'true');
  head.appendChild(preload);
}

function createAudioAckTimeout({
  ackId,
  refs,
  stopForRealtimeInstability,
}: {
  ackId: number;
  refs: AudioStreamingRuntimeRefs;
  stopForRealtimeInstability: (message: string, reason: string) => void;
}): number {
  return window.setTimeout(() => {
    const trackedTimer = refs.ackTimeoutMapRef.current.get(ackId);
    if (trackedTimer === undefined) return;

    refs.ackTimeoutMapRef.current.delete(ackId);
    refs.inFlightAckCountRef.current = Math.max(
      0,
      refs.inFlightAckCountRef.current - 1,
    );
    refs.consecutiveTimeoutRef.current += 1;
    if (
      refs.consecutiveTimeoutRef.current >=
      AUDIO_STREAMING_LIMITS.MAX_CONSECUTIVE_TIMEOUTS
    ) {
      stopForRealtimeInstability(
        '응답 지연이 지속되어 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
        'client-ack-timeout',
      );
    }
  }, AUDIO_STREAMING_LIMITS.ACK_TIMEOUT_MS);
}

function handleSaturatedAudioQueue({
  refs,
  stopForRealtimeInstability,
}: {
  refs: AudioStreamingRuntimeRefs;
  stopForRealtimeInstability: (message: string, reason: string) => void;
}) {
  const now = Date.now();
  if (refs.saturationStartAtRef.current === null) {
    refs.saturationStartAtRef.current = now;
    return;
  }

  if (shouldFallbackForSaturation(refs.saturationStartAtRef.current, now)) {
    stopForRealtimeInstability(
      '네트워크 지연으로 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
      'client-network-saturation',
    );
  }
}

function stopWorkletNode(refs: AudioStreamingRuntimeRefs) {
  if (!refs.workletNodeRef.current) return;
  try {
    refs.workletNodeRef.current.port.postMessage('stop');
    refs.workletNodeRef.current.disconnect();
  } catch {
    // no-op
  }
  refs.workletNodeRef.current = null;
}

function disconnectSourceNode(refs: AudioStreamingRuntimeRefs) {
  if (!refs.sourceNodeRef.current) return;
  try {
    refs.sourceNodeRef.current.disconnect();
  } catch {
    // no-op
  }
  refs.sourceNodeRef.current = null;
}

function closeAudioContext(refs: AudioStreamingRuntimeRefs) {
  if (refs.audioContextRef.current?.state === 'closed') return;
  void refs.audioContextRef.current?.close();
  refs.audioContextRef.current = null;
}
