import { useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { createSocket } from '@/lib/api/websocket';
import type { RealtimeTranscriptPayload } from '../types/transcription.types';

interface UseTranscriptionOptions {
  onFallbackToBatch?: (payload?: { reason?: string }) => void;
}

export function useTranscription(
  meetingId: string,
  isRealtimeEnabled: boolean = false,
  options?: UseTranscriptionOptions,
) {
  const fallbackHandler = options?.onFallbackToBatch;
  const { data: session, status: authStatus } = useSession();
  // accessToken 을 ref 로 저장 → 토큰 갱신 시 소켓이 끊기지 않도록
  const accessTokenRef = useRef<string | undefined>(undefined);
  const {
    segments,
    partial,
    isConnected,
    isTranscriptExpanded,
    hasActiveSession,
    error,
    handlePayload,
    clearTranscripts,
    toggleExpanded,
    setConnected,
    setHasActiveSession,
    setError,
  } = useTranscriptionStore();

  const socketRef = useRef<Socket | null>(null);
  const fallbackCallbackRef = useRef(options?.onFallbackToBatch);

  useEffect(() => {
    fallbackCallbackRef.current = fallbackHandler;
  }, [fallbackHandler]);

  const stopSession = useCallback(async (): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setHasActiveSession(false);
      return false;
    }

    const success = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const timerId = window.setTimeout(() => done(false), 1500);
      socket.emit(
        'transcript:stop',
        (response?: { ok?: boolean }) => {
          window.clearTimeout(timerId);
          done(Boolean(response?.ok));
        },
      );
    });

    if (success) {
      setHasActiveSession(false);
    }
    return success;
  }, [setHasActiveSession]);

  useEffect(() => {
    if (!meetingId || !isRealtimeEnabled) {
      setConnected(false);
      setHasActiveSession(false);
      setError(null);
      clearTranscripts();
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus !== 'authenticated' || !session?.accessToken) {
      setConnected(false);
      setHasActiveSession(false);
      setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }

    // 최초 연결 시점의 토큰을 캡처 (이후 갱신되어도 소켓 재연결하지 않음)
    accessTokenRef.current = session.accessToken;

    // same-origin WebSocket 연결 (Next.js rewrite 프록시)
    // getter 함수 전달 → 재연결(reconnect) 시마다 최신 토큰으로 handshake
    const socket = createSocket('/ws/transcribe', { meetingId }, () => accessTokenRef.current);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setHasActiveSession(false);
    });

    socket.on('connected', (data: { meetingId: string; hasActiveSession: boolean }) => {
      setHasActiveSession(data.hasActiveSession);
    });

    socket.on('error', (err: { message?: string }) => {
      setError(err.message || 'Transcription error');
    });

    // 실시간 전사 이벤트 수신
    socket.on('transcript:partial', (payload: RealtimeTranscriptPayload) => {
      handlePayload(payload);
    });

    socket.on('transcript:final', (payload: RealtimeTranscriptPayload) => {
      handlePayload(payload);
    });

    socket.on('transcript:translation', (payload: RealtimeTranscriptPayload) => {
      handlePayload(payload);
    });

    socket.on('transcript:error', (err: { message?: string }) => {
      setError(err.message || 'Transcription stream error');
    });

    socket.on(
      'transcript:fallback',
      (payload: { mode?: 'batch'; reason?: string }) => {
        if (payload.mode === 'batch') {
          fallbackCallbackRef.current?.({ reason: payload.reason });
        }
      },
    );

    socket.on('transcript:session-ended', () => {
      setHasActiveSession(false);
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      clearTranscripts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRealtimeEnabled,
    authStatus,
    meetingId,
    clearTranscripts,
    handlePayload,
    setConnected,
    setHasActiveSession,
    setError,
  ]);

  // accessToken 이 갱신되면 ref 만 업데이트 (소켓 재연결 안 함)
  useEffect(() => {
    if (session?.accessToken) {
      accessTokenRef.current = session.accessToken;
    }
  }, [session?.accessToken]);

  return {
    /** 확정된 전사 세그먼트 목록 */
    segments,
    /** 현재 진행중인 partial 텍스트 */
    partial,
    isConnected,
    isTranscriptExpanded,
    hasActiveSession,
    error,
    toggleExpanded,
    stopSession,
    /** socket.io 인스턴스 (useAudioStreaming에서 사용) */
    socketRef,
  };
}
