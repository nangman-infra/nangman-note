import { useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { transcriptionApi } from '../api/transcriptionApi';
import { createSocket } from '@/lib/api/websocket';
import {
  bindTranscriptionSocketHandlers,
  recoverTranscriptionSocketAuth,
  stopTranscriptionSession,
} from '../lib/transcriptionSocketSession';

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
  const hasSessionToken = Boolean(session?.accessToken);
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
    syncSegmentsFromServer,
    clearTranscripts,
    toggleExpanded,
    setConnected,
    setHasActiveSession,
    setError,
  } = useTranscriptionStore();

  const socketRef = useRef<Socket | null>(null);
  const fallbackCallbackRef = useRef(options?.onFallbackToBatch);
  const authRecoveryPendingRef = useRef(false);
  const isRecoveringAuthRef = useRef(false);

  useEffect(() => {
    fallbackCallbackRef.current = fallbackHandler;
  }, [fallbackHandler]);

  const stopSession = useCallback(async (): Promise<boolean> => {
    return stopTranscriptionSession({
      socket: socketRef.current,
      setHasActiveSession,
    });
  }, [setHasActiveSession]);

  const recoverSocketAuth = useCallback(async (socket: Socket) => {
    await recoverTranscriptionSocketAuth({
      socket,
      socketRef,
      accessTokenRef,
      isRecoveringAuthRef,
      setError,
    });
  }, [setError]);

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

    if (authStatus !== 'authenticated' || !hasSessionToken) {
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

    bindTranscriptionSocketHandlers({
      socket,
      authRecoveryPendingRef,
      fallbackCallbackRef,
      recoverSocketAuth: (nextSocket) => {
        void recoverSocketAuth(nextSocket);
      },
      setConnected,
      setHasActiveSession,
      setError,
      handlePayload,
      onReconnected: () => {
        // 단절 중 놓친 final 세그먼트를 DB에서 재동기화
        void transcriptionApi
          .list(meetingId)
          .then((serverSegments) => {
            syncSegmentsFromServer(serverSegments);
          })
          .catch(() => {
            // 재동기화 실패는 다음 재연결에서 재시도
          });
      },
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      authRecoveryPendingRef.current = false;
      isRecoveringAuthRef.current = false;
      clearTranscripts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRealtimeEnabled,
    authStatus,
    hasSessionToken,
    meetingId,
    clearTranscripts,
    handlePayload,
    syncSegmentsFromServer,
    setConnected,
    setHasActiveSession,
    setError,
    recoverSocketAuth,
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
