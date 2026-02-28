'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/api/websocket';

interface MeetingStatusMessage {
  meetingId: string;
  status: string;
}

interface UseMeetingStatusOptions {
  meetingId: string | null;
  onStatusChange?: (message: MeetingStatusMessage) => void;
}

/**
 * 회의 상태 변경을 WebSocket 으로 실시간 수신하는 훅.
 * 백엔드 MeetingStatusGateway(/ws/meeting-status) 에 연결됩니다.
 */
export function useMeetingStatus({
  meetingId,
  onStatusChange,
}: UseMeetingStatusOptions): void {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!meetingId) {
      cleanup();
      return;
    }

    const socket = createSocket('/ws/meeting-status', { meetingId });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[MeetingStatus] WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('[MeetingStatus] WebSocket disconnected');
    });

    socket.on('error', (error: unknown) => {
      console.error('[MeetingStatus] WebSocket error:', error);
    });

    socket.on('meeting:status', (message: MeetingStatusMessage) => {
      console.log('[MeetingStatus] Status changed:', message);
      callbackRef.current?.(message);
    });

    return cleanup;
  }, [meetingId, cleanup]);
}