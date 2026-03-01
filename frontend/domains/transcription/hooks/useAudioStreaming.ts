'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

// PCM processor는 AudioContext의 네이티브 sample rate(48kHz)를 그대로 사용합니다.
// 다운샘플링 없이 Transcribe에 실제 rate를 전달합니다.

export type AudioStreamingState = 'idle' | 'streaming' | 'stopping' | 'stopped' | 'error';

interface UseAudioStreamingReturn {
  state: AudioStreamingState;
  error: string | null;
  startStreaming: (stream: MediaStream, socket: Socket) => Promise<void>;
  stopStreaming: () => void;
}

/**
 * AudioWorklet 기반 실시간 PCM 오디오 스트리밍 훅.
 * 마이크 스트림에서 PCM 16-bit LE mono(브라우저 네이티브 sample rate)를 추출하여
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
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        socketRef.current = socket;

        // Chrome autoplay 정책: 사용자 제스처 없이 생성된 AudioContext는
        // suspended 상태일 수 있음 → resume() 필수
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

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

        // worklet에서 PCM ArrayBuffer를 받아 socket으로 전송
        workletNode.port.onmessage = (event: MessageEvent) => {
          const pcmBuffer: ArrayBuffer = event.data;
          if (pcmBuffer && pcmBuffer.byteLength > 0 && socketRef.current?.connected) {
            socketRef.current.emit('audio', pcmBuffer);
          }
        };

        source.connect(workletNode);
        // 마이크 오디오를 스피커로 직접 출력하면 피드백 에코가 발생하므로
        // GainNode(gain=0)을 통해 무음으로 destination에 연결.
        // destination 연결이 없으면 Chrome이 process() 호출을 중단할 수 있음.
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
