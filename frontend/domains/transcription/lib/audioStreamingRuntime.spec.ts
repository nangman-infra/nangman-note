// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import {
  clearAudioAckTrackers,
  drainPendingChunks,
  handleAudioAckResponse,
  handleAudioChunk,
  type AudioStreamingRuntimeRefs,
  type AudioStreamingState,
} from './audioStreamingRuntime';
import {
  AUDIO_STREAMING_LIMITS,
  type AudioAckResponse,
} from '../hooks/audioStreamingPolicy';

function ref<T>(current: T) {
  return { current };
}

function createRefs(socket: Socket): AudioStreamingRuntimeRefs {
  return {
    audioContextRef: ref<AudioContext | null>(null),
    workletNodeRef: ref<AudioWorkletNode | null>(null),
    sourceNodeRef: ref<MediaStreamAudioSourceNode | null>(null),
    socketRef: ref<Socket | null>(socket),
    optionsRef: ref(undefined),
    fallbackNotifiedRef: ref(false),
    inFlightAckCountRef: ref(0),
    nextAckIdRef: ref(1),
    ackTimeoutMapRef: ref(new Map()),
    chunkByAckIdRef: ref(new Map()),
    pendingChunksRef: ref([]),
    nextChunkSeqRef: ref(1),
    lastAcceptedSeqRef: ref(0),
    disconnectedAtRef: ref<number | null>(null),
    consecutiveTimeoutRef: ref(0),
    consecutiveBackpressureRef: ref(0),
    saturationStartAtRef: ref<number | null>(null),
    retryBackoffUntilRef: ref(0),
    retryDrainTimerRef: ref<number | null>(null),
    stoppedByGuardRef: ref(false),
    lastTransportNoticeAtRef: ref<number | null>(null),
  };
}

function createSocket() {
  const acknowledgements: Array<(ack?: AudioAckResponse) => void> = [];
  const emit = vi.fn(
    (
      event: string,
      _data: Uint8Array,
      ack: (response?: AudioAckResponse) => void,
    ) => {
      if (event === 'audio') acknowledgements.push(ack);
    },
  );
  const socket = { connected: true, emit } as unknown as Socket;
  return { socket, emit, acknowledgements };
}

function createAckPipeline(
  refs: AudioStreamingRuntimeRefs,
  stopForRealtimeInstability: (message: string, reason: string) => void,
) {
  const setState = vi.fn() as Dispatch<SetStateAction<AudioStreamingState>>;
  const setError = vi.fn() as Dispatch<SetStateAction<string | null>>;
  const onAck = (ackId: number, ack?: AudioAckResponse) => {
    handleAudioAckResponse({
      ackId,
      ack,
      refs,
      requestSessionStop: vi.fn(),
      notifyFallbackToBatch: vi.fn(),
      cleanup: vi.fn(),
      setState,
      setError,
      stopForRealtimeInstability,
    });
    drainPendingChunks({ refs, stopForRealtimeInstability, onAck });
  };
  return onAck;
}

function chunk() {
  return new ArrayBuffer(6400);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('audioStreamingRuntime', () => {
  it('keeps exactly one audio chunk in flight until its ACK arrives', () => {
    const { socket, emit, acknowledgements } = createSocket();
    const refs = createRefs(socket);
    const stop = vi.fn();
    const onAck = createAckPipeline(refs, stop);

    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(refs.inFlightAckCountRef.current).toBe(1);
    expect(refs.pendingChunksRef.current).toHaveLength(2);

    acknowledgements[0]?.({ ok: true });

    expect(emit).toHaveBeenCalledTimes(2);
    expect(refs.inFlightAckCountRef.current).toBe(1);
    expect(refs.pendingChunksRef.current).toHaveLength(1);
  });

  it('falls back when a single in-flight ACK leaves a sustained backlog', () => {
    const { socket } = createSocket();
    const refs = createRefs(socket);
    const stop = vi.fn();
    const onAck = createAckPipeline(refs, stop);

    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    vi.setSystemTime(
      new Date(Date.now() + AUDIO_STREAMING_LIMITS.MAX_SATURATION_MS),
    );
    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });

    expect(stop).toHaveBeenCalledWith(
      expect.any(String),
      'client-network-saturation',
    );
  });

  it('honors server retryAfterMs before resending a rejected chunk', () => {
    const { socket, emit, acknowledgements } = createSocket();
    const refs = createRefs(socket);
    const stop = vi.fn();
    const onAck = createAckPipeline(refs, stop);

    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    acknowledgements[0]?.({
      ok: false,
      reason: 'backpressure',
      retryAfterMs: 500,
    });

    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(499);
    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('cancels a scheduled retry drain during cleanup', () => {
    const { socket, emit, acknowledgements } = createSocket();
    const refs = createRefs(socket);
    const stop = vi.fn();
    const onAck = createAckPipeline(refs, stop);

    handleAudioChunk({ chunk: chunk(), refs, stopForRealtimeInstability: stop, onAck });
    acknowledgements[0]?.({
      ok: false,
      reason: 'backpressure',
      retryAfterMs: 500,
    });
    expect(refs.retryDrainTimerRef.current).not.toBeNull();

    clearAudioAckTrackers(refs);
    vi.advanceTimersByTime(500);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(refs.pendingChunksRef.current).toHaveLength(0);
  });
});
