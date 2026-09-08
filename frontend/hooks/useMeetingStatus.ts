'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSession, useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/api/websocket';
import { isSocketAuthError } from '@/lib/api/socketAuth';

export type MeetingStatusPhase =
  | 'uploading'
  | 'transcribing'
  | 'generating'
  | 'regenerating';

export type MeetingStatusCompletionState =
  | 'succeeded'
  | 'partial'
  | 'attention_required'
  | 'failed';

export interface MeetingStatusMessage {
  meetingId: string;
  status: string;
  phase?: MeetingStatusPhase | 'completed';
  needsAttention?: boolean;
  completionState?: MeetingStatusCompletionState | null;
}

export interface ResultRegenerateMessage {
  meetingId: string;
  phase: 'started' | 'completed' | 'failed';
  errorMessage?: string;
}

interface UseMeetingStatusOptions {
  meetingId?: string | null;
  onStatusChange?: (message: MeetingStatusMessage) => void;
  onResultRegenerate?: (message: ResultRegenerateMessage) => void;
  enabled?: boolean;
}

export interface UseMeetingStatusResult {
  /** 실시간 상태 소켓이 연결되어 있는지. 폴링 주기를 완화하는 데 사용 */
  isConnected: boolean;
}

/**
 * 회의 상태 변경을 WebSocket 으로 실시간 수신하는 훅.
 * 백엔드 MeetingStatusGateway(/ws/meeting-status) 에 연결됩니다.
 */
export function useMeetingStatus({
  meetingId,
  onStatusChange,
  onResultRegenerate,
  enabled = true,
}: UseMeetingStatusOptions): UseMeetingStatusResult {
  const { data: session, status: authStatus } = useSession();
  const hasSessionToken = Boolean(session?.accessToken) && !session?.error;
  const accessTokenRef = useRef<string | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);
  const authRecoveryPendingRef = useRef(false);
  const isRecoveringAuthRef = useRef(false);
  const callbackRef = useRef(onStatusChange);
  const regenerateCallbackRef = useRef(onResultRegenerate);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    regenerateCallbackRef.current = onResultRegenerate;
  }, [onResultRegenerate]);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    authRecoveryPendingRef.current = false;
    isRecoveringAuthRef.current = false;
    setIsConnected(false);
  }, []);

  const recoverSocketAuth = useCallback(async (socket: Socket) => {
    if (isRecoveringAuthRef.current) {
      return;
    }
    isRecoveringAuthRef.current = true;

    try {
      const refreshedSession = await getSession();
      const refreshedToken = refreshedSession?.accessToken;
      // refresh 실패 시 stale token 으로 재연결하면 무한 실패 루프가 되므로 중단.
      // 재로그인 유도는 AuthSessionProvider 가 담당한다.
      if (
        refreshedSession?.error === 'RefreshAccessTokenError' ||
        !refreshedToken
      ) {
        return;
      }

      accessTokenRef.current = refreshedToken;

      if (!socket.connected && socketRef.current === socket) {
        socket.connect();
      }
    } finally {
      isRecoveringAuthRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }
    if (authStatus !== 'authenticated' || !hasSessionToken) {
      cleanup();
      return;
    }

    accessTokenRef.current = session.accessToken;

    const query = meetingId ? { meetingId } : undefined;
    // getter 함수 전달 → 재연결(reconnect) 시마다 최신 토큰으로 handshake
    const socket = createSocket(
      '/ws/meeting-status',
      query,
      () => accessTokenRef.current,
    );
    socketRef.current = socket;

    socket.on('connect', () => {
      authRecoveryPendingRef.current = false;
      setIsConnected(true);
    });

    socket.on('error', (payload: unknown) => {
      if (!isSocketAuthError(payload)) {
        return;
      }

      authRecoveryPendingRef.current = true;
      void recoverSocketAuth(socket);
    });

    socket.on('connect_error', (payload: unknown) => {
      if (!isSocketAuthError(payload)) {
        return;
      }

      authRecoveryPendingRef.current = true;
      void recoverSocketAuth(socket);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason !== 'io server disconnect' || !authRecoveryPendingRef.current) {
        return;
      }

      authRecoveryPendingRef.current = false;
      void recoverSocketAuth(socket);
    });

    socket.on('meeting:status', (message: MeetingStatusMessage) => {
      if (meetingId && message.meetingId !== meetingId) {
        return;
      }
      callbackRef.current?.(message);
    });

    socket.on('result:regenerate', (message: ResultRegenerateMessage) => {
      if (meetingId && message.meetingId !== meetingId) {
        return;
      }
      regenerateCallbackRef.current?.(message);
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, cleanup, enabled, authStatus, hasSessionToken, recoverSocketAuth]);

  // accessToken 이 갱신되면 ref 만 업데이트 (소켓 재연결 안 함)
  useEffect(() => {
    if (session?.accessToken) {
      accessTokenRef.current = session.accessToken;
    }
  }, [session?.accessToken]);

  return { isConnected };
}
