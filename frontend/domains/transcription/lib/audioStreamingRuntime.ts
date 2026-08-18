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

/** 재전송 대기 청크 (전송 실패·단절·워밍업 구간 버퍼) */
interface PendingChunk {
  data: ArrayBuffer;
  /** 캡처 순서 (순서 보존용 — 재전송 시 이 순서대로만 보낸다) */
  seq: number;
  retries: number;
}

/** 버퍼 한도: 200ms 청크 기준 약 60초 분량 (~2MB) */
const MAX_PENDING_CHUNKS = 300;
/** 청크당 최대 재전송 횟수 (워밍업/백프레셔 재시도) */
const MAX_CHUNK_RETRIES = 50;
/** 소켓 장기 단절 시 배치 폴백까지의 허용 시간 */
const MAX_DISCONNECTED_MS = 45_000;

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
  /** ackId → 전송한 청크 (실패 시 재전송용) */
  chunkByAckIdRef: MutableRefObject<Map<number, PendingChunk>>;
  /** 단절·워밍업·백프레셔 구간에 유실 없이 보관하는 청크 버퍼 (seq 오름차순) */
  pendingChunksRef: MutableRefObject<PendingChunk[]>;
  /** 캡처 순서 시퀀스 카운터 */
  nextChunkSeqRef: MutableRefObject<number>;
  /** 서버가 수락한 가장 큰 seq — 이보다 오래된 청크는 재전송하지 않는다 (순서 붕괴 방지) */
  lastAcceptedSeqRef: MutableRefObject<number>;
  /** 소켓 단절 시작 시각 (장기 단절 가드용) */
  disconnectedAtRef: MutableRefObject<number | null>;
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
  const chunkByAckIdRef = useRef<Map<number, PendingChunk>>(new Map());
  const pendingChunksRef = useRef<PendingChunk[]>([]);
  const nextChunkSeqRef = useRef(1);
  const lastAcceptedSeqRef = useRef(0);
  const disconnectedAtRef = useRef<number | null>(null);
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
      chunkByAckIdRef,
      pendingChunksRef,
      nextChunkSeqRef,
      lastAcceptedSeqRef,
      disconnectedAtRef,
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
  refs.chunkByAckIdRef.current.clear();
  refs.pendingChunksRef.current = [];
  refs.nextChunkSeqRef.current = 1;
  refs.lastAcceptedSeqRef.current = 0;
  refs.disconnectedAtRef.current = null;
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
  // 서버(AWS Transcribe)는 16kHz PCM으로 해석하므로 AudioContext를 16kHz로
  // 고정한다 (브라우저가 하드웨어 레이트에서 리샘플링).
  // Firefox 계열은 컨텍스트 생성은 성공하지만 createMediaStreamSource에서
  // 스트림 레이트 불일치로 NotSupportedError를 던지므로, 소스 생성 실패까지
  // 포괄해 기본 레이트로 폴백한다 (워크릿이 다운샘플).
  let audioContext: AudioContext;
  let source: MediaStreamAudioSourceNode;
  try {
    audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 16_000,
    });
    try {
      source = audioContext.createMediaStreamSource(stream);
    } catch (sourceError) {
      void audioContext.close().catch(() => undefined);
      throw sourceError;
    }
  } catch {
    audioContext = new AudioContext({ latencyHint: 'interactive' });
    source = audioContext.createMediaStreamSource(stream);
  }
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

/** 버퍼에 청크를 seq 오름차순으로 삽입한다 (초과 시 가장 오래된 것부터 폐기). */
function bufferPendingChunk(
  refs: AudioStreamingRuntimeRefs,
  pending: PendingChunk,
) {
  const buffer = refs.pendingChunksRef.current;

  // 대부분은 최신 seq이므로 append; 재전송 청크만 정렬 위치에 삽입
  const last = buffer[buffer.length - 1];
  if (!last || pending.seq > last.seq) {
    buffer.push(pending);
  } else {
    const insertIndex = buffer.findIndex((item) => item.seq > pending.seq);
    if (insertIndex === -1) {
      buffer.push(pending);
    } else {
      buffer.splice(insertIndex, 0, pending);
    }
  }

  while (buffer.length > MAX_PENDING_CHUNKS) {
    buffer.shift();
  }
}

/**
 * 버퍼에 쌓인 청크를 seq 순서대로 전송한다.
 * (재연결·세션 워밍업 완료 후 유실 없이 이어 보내기 위한 드레인)
 *
 * 순서 보장:
 * - 이미 수락된 seq 이하의 청크는 폐기 (과거 오디오를 뒤에 붙이면 순서 붕괴)
 * - 한 청크의 ACK가 끝나기 전에는 다음 청크를 전송하지 않는다. socket.io
 *   ACK는 서버 도착 순서를 보장하지 않으므로, 다중 in-flight 전송은 서버가
 *   최신 오디오를 먼저 수락하는 순서 역전으로 이어질 수 있다.
 */
export function drainPendingChunks({
  refs,
  stopForRealtimeInstability,
  onAck,
}: {
  refs: AudioStreamingRuntimeRefs;
  stopForRealtimeInstability: (message: string, reason: string) => void;
  onAck: (ackId: number, ack?: AudioAckResponse) => void;
}) {
  const socket = refs.socketRef.current;
  if (!socket?.connected) return;

  const pending = refs.pendingChunksRef.current;

  while (pending.length > 0 && refs.inFlightAckCountRef.current === 0) {
    const head = pending[0];

    // 서버가 이미 더 최신 청크를 수락했으면 이 과거 청크는 폐기
    if (head.seq <= refs.lastAcceptedSeqRef.current) {
      pending.shift();
      continue;
    }

    pending.shift();
    sendAudioChunk({ pending: head, refs, stopForRealtimeInstability, onAck });
  }

  if (
    pending.length > 0 &&
    refs.inFlightAckCountRef.current >= AUDIO_STREAMING_LIMITS.MAX_IN_FLIGHT_ACKS
  ) {
    handleSaturatedAudioQueue({ refs, stopForRealtimeInstability });
  } else {
    refs.saturationStartAtRef.current = null;
  }
}

function sendAudioChunk({
  pending,
  refs,
  stopForRealtimeInstability,
  onAck,
}: {
  pending: PendingChunk;
  refs: AudioStreamingRuntimeRefs;
  stopForRealtimeInstability: (message: string, reason: string) => void;
  onAck: (ackId: number, ack?: AudioAckResponse) => void;
}) {
  const socket = refs.socketRef.current;
  if (!socket?.connected) {
    bufferPendingChunk(refs, pending);
    return;
  }

  const ackId = refs.nextAckIdRef.current++;
  refs.inFlightAckCountRef.current += 1;
  const timeoutId = createAudioAckTimeout({
    ackId,
    refs,
    stopForRealtimeInstability,
  });

  refs.ackTimeoutMapRef.current.set(ackId, timeoutId);
  refs.chunkByAckIdRef.current.set(ackId, pending);
  socket.emit('audio', new Uint8Array(pending.data), (ack?: AudioAckResponse) => {
    onAck(ackId, ack);
  });
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
  const pending: PendingChunk = {
    data: chunk,
    seq: refs.nextChunkSeqRef.current++,
    retries: 0,
  };

  if (!socket?.connected) {
    // 단절 구간 오디오를 폐기하지 않고 버퍼링한다 (재연결 시 이어 전송).
    bufferPendingChunk(refs, pending);

    // 장기 단절 가드: 소켓이 끊긴 동안엔 ack 타임아웃 카운터가 동작하지
    // 않으므로, 여기서 직접 단절 시간을 추적해 배치 폴백을 트리거한다.
    const now = Date.now();
    if (refs.disconnectedAtRef.current === null) {
      refs.disconnectedAtRef.current = now;
    } else if (now - refs.disconnectedAtRef.current >= MAX_DISCONNECTED_MS) {
      stopForRealtimeInstability(
        '실시간 연결이 장시간 끊겨 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
        'client-connection-lost',
      );
    }
    return;
  }

  refs.disconnectedAtRef.current = null;

  // 순서 보존: 새 청크를 버퍼에 넣고 seq 순서대로 드레인
  bufferPendingChunk(refs, pending);
  drainPendingChunks({ refs, stopForRealtimeInstability, onAck });
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
  const sentChunk = refs.chunkByAckIdRef.current.get(ackId);
  refs.chunkByAckIdRef.current.delete(ackId);
  refs.inFlightAckCountRef.current = Math.max(
    0,
    refs.inFlightAckCountRef.current - 1,
  );
  refs.consecutiveTimeoutRef.current = 0;

  const response = ack ?? { ok: false, reason: 'ack-timeout' };
  if (response.ok) {
    refs.consecutiveBackpressureRef.current = 0;
    if (sentChunk && sentChunk.seq > refs.lastAcceptedSeqRef.current) {
      refs.lastAcceptedSeqRef.current = sentChunk.seq;
    }
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

  // 일시적 거부(세션 워밍업·백프레셔)는 청크를 폐기하지 않고 재전송 큐에
  // 되돌린다 — 특히 세션 워밍업(1~3초) 동안의 첫 발화 유실을 방지.
  // 단, 서버가 이미 더 최신 seq를 수락했다면 과거 청크를 다시 보내면
  // 오디오 스트림 순서가 붕괴되므로 폐기한다 (기존 동작과 동일한 손실).
  const isRetryableRejection =
    response.reason === 'session-warming' ||
    response.reason === 'backpressure' ||
    response.reason === 'session-start-failed';
  if (
    sentChunk &&
    isRetryableRejection &&
    sentChunk.seq > refs.lastAcceptedSeqRef.current &&
    sentChunk.retries < MAX_CHUNK_RETRIES
  ) {
    sentChunk.retries += 1;
    bufferPendingChunk(refs, sentChunk);
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
    // ack 타임아웃은 서버 처리 여부가 불명확하므로 재전송하지 않는다 (중복 방지)
    refs.chunkByAckIdRef.current.delete(ackId);
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
