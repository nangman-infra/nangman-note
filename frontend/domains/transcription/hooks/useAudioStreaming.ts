'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const TARGET_SAMPLE_RATE = 16_000; // Transcribe expects 16kHz PCM

export type AudioStreamingState = 'idle' | 'streaming' | 'stopping' | 'stopped' | 'error';

interface UseAudioStreamingReturn {
  state: AudioStreamingState;
  error: string | null;
  startStreaming: (stream: MediaStream, socket: Socket) => Promise<void>;
  stopStreaming: () => void;
}

/**
 * AudioWorklet 기반 실시간 PCM 오디오 스트리밍 훅.
 * 마이크 스트림에서 PCM 16-bit LE mono 16kHz를 추출하여
 * WebSocket으로 binary 전송합니다.
 */
export function useAudioStreaming(): UseAudioStreamingReturn {
  const [state, setState] = useState<AudioStreamingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const cleanup = useCallback(() => {
    // worklet에 stop 메시지 전송
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage('stop');
        workletNodeRef.current.disconnect();
      } catch {
        // 이미 disconnect됨
      }
      workletNodeRef.current = null;
    }

    // source 해제
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // 이미 disconnect됨
      }
      sourceNodeRef.current = null;
    }

    // AudioContext 닫기
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    socketRef.current = null;
  }, []);

  const startStreaming = useCallback(
    async (stream: MediaStream, socket: Socket) => {
      setError(null);

      try {
        // AudioContext를 기본 sample rate로 생성 (마이크와 동일 — 보통 48kHz)
        // 다운샘플링은 AudioWorklet processor에서 처리
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        socketRef.current = socket;

        const nativeSampleRate = audioContext.sampleRate;

        // AudioWorklet 모듈 로드 (public 디렉토리)
        await audioContext.audioWorklet.addModule(
          '/audio-worklet/pcm-processor.js',
        );

        // 마이크 소스 → AudioWorklet → PCM 데이터 추출
        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const workletNode = new AudioWorkletNode(
          audioContext,
          'pcm-processor',
        );
        workletNodeRef.current = workletNode;

        // WorkletProcessor에게 네이티브 sample rate와 타겟 sample rate를 전달
        workletNode.port.postMessage({
          type: 'init',
          nativeSampleRate,
          targetSampleRate: TARGET_SAMPLE_RATE,
        });

        // worklet에서 PCM ArrayBuffer를 받아 socket으로 전송
        workletNode.port.onmessage = (event: MessageEvent) => {
          const pcmBuffer: ArrayBuffer = event.data;
          if (pcmBuffer && pcmBuffer.byteLength > 0 && socketRef.current?.connected) {
            socketRef.current.emit('audio', pcmBuffer);
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

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
    [cleanup],
  );

  const stopStreaming = useCallback(() => {
    setState('stopping');
    cleanup();
    setState('stopped');
  }, [cleanup]);

  // 컴포넌트 언마운트 시 정리
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