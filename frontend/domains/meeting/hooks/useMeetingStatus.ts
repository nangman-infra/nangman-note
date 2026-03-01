'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/api/websocket';

interface MeetingStatusMessage {
  meetingId: string;
  status: string;
  phase?: 'transcribing' | 'generating' | 'completed';
}

interface UseMeetingStatusOptions {
  meetingId?: string | null;
  onStatusChange?: (message: MeetingStatusMessage) => void;
  enabled?: boolean;
}

/**
 * 회의 상태 변경을 WebSocket 으로 실시간 수신하는 훅.
 * 백엔드 MeetingStatusGateway(/ws/meeting-status) 에 연결됩니다.
 */
export function useMeetingStatus({
  meetingId,
  onStatusChange,
  enabled = true,
}: UseMeetingStatusOptions): void {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onStatusChange);

  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const query = meetingId ? { meetingId } : undefined;
    const socket = createSocket('/ws/meeting-status', query);
    socketRef.current = socket;

    socket.on('meeting:status', (message: MeetingStatusMessage) => {
      callbackRef.current?.(message);
    });

    return cleanup;
  }, [meetingId, cleanup, enabled]);
}
