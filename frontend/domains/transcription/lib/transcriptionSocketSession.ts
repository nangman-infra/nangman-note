import { getSession } from 'next-auth/react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { extractSocketErrorMessage, isSocketAuthError } from '@/lib/api/socketAuth';
import type { RealtimeTranscriptPayload } from '../types/transcription.types';

export async function stopTranscriptionSession({
  socket,
  setHasActiveSession,
}: {
  socket: Socket | null;
  setHasActiveSession: (hasActiveSession: boolean) => void;
}): Promise<boolean> {
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
    socket.emit('transcript:stop', (response?: { ok?: boolean }) => {
      window.clearTimeout(timerId);
      done(Boolean(response?.ok));
    });
  });

  if (success) {
    setHasActiveSession(false);
  }
  return success;
}

export async function recoverTranscriptionSocketAuth({
  socket,
  socketRef,
  accessTokenRef,
  isRecoveringAuthRef,
  setError,
}: {
  socket: Socket;
  socketRef: MutableRefObject<Socket | null>;
  accessTokenRef: MutableRefObject<string | undefined>;
  isRecoveringAuthRef: MutableRefObject<boolean>;
  setError: (message: string | null) => void;
}) {
  if (isRecoveringAuthRef.current) {
    return;
  }
  isRecoveringAuthRef.current = true;

  try {
    const refreshedSession = await getSession();
    const refreshedToken = refreshedSession?.accessToken;
    if (!refreshedToken) {
      setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }

    accessTokenRef.current = refreshedToken;

    if (!socket.connected && socketRef.current === socket) {
      socket.connect();
    }
  } finally {
    isRecoveringAuthRef.current = false;
  }
}

export function bindTranscriptionSocketHandlers({
  socket,
  authRecoveryPendingRef,
  fallbackCallbackRef,
  recoverSocketAuth,
  setConnected,
  setHasActiveSession,
  setError,
  handlePayload,
  onReconnected,
}: {
  socket: Socket;
  authRecoveryPendingRef: MutableRefObject<boolean>;
  fallbackCallbackRef: MutableRefObject<
    ((payload?: { reason?: string }) => void) | undefined
  >;
  recoverSocketAuth: (socket: Socket) => void;
  setConnected: (isConnected: boolean) => void;
  setHasActiveSession: (hasActiveSession: boolean) => void;
  setError: (message: string | null) => void;
  handlePayload: (payload: RealtimeTranscriptPayload) => void;
  /** 재연결(최초 연결 제외) 시 호출 — 단절 중 놓친 세그먼트 재동기화용 */
  onReconnected?: () => void;
}) {
  let hasConnectedOnce = false;

  socket.on('connect', () => {
    authRecoveryPendingRef.current = false;
    setConnected(true);
    setError(null);

    if (hasConnectedOnce) {
      // 단절 중 emit된 transcript:final은 다시 수신할 수 없으므로
      // DB에 저장된 세그먼트를 재조회해 화면 공백을 복구한다.
      onReconnected?.();
    }
    hasConnectedOnce = true;
  });

  socket.on('disconnect', (reason) => {
    setConnected(false);
    setHasActiveSession(false);

    if (reason === 'io server disconnect' && authRecoveryPendingRef.current) {
      authRecoveryPendingRef.current = false;
      recoverSocketAuth(socket);
    }
  });

  // 자동 재연결 최대 횟수 소진: 이대로 두면 UI가 영구 '연결 중...'에 갇히고
  // 오디오만 계속 폐기된다. 명시적으로 실패를 알리고 배치 폴백을 트리거한다.
  socket.io.on('reconnect_failed', () => {
    setConnected(false);
    setHasActiveSession(false);
    setError(
      '실시간 연결을 복구하지 못했습니다. 남은 구간은 배치 전사로 처리됩니다.',
    );
    fallbackCallbackRef.current?.({ reason: 'client-connection-lost' });
  });

  socket.on('connected', (data: { meetingId: string; hasActiveSession: boolean }) => {
    setHasActiveSession(data.hasActiveSession);
  });

  socket.on('error', (payload: unknown) => {
    if (isSocketAuthError(payload)) {
      authRecoveryPendingRef.current = true;
      recoverSocketAuth(socket);
    }

    setError(extractSocketErrorMessage(payload) || 'Transcription error');
  });

  socket.on('connect_error', (payload: unknown) => {
    if (isSocketAuthError(payload)) {
      authRecoveryPendingRef.current = true;
      recoverSocketAuth(socket);
    }

    setConnected(false);
    setHasActiveSession(false);
    setError(
      extractSocketErrorMessage(payload) || 'Transcription connection failed',
    );
  });

  socket.on('transcript:partial', handlePayload);
  socket.on('transcript:final', handlePayload);
  socket.on('transcript:translation', handlePayload);
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
}
