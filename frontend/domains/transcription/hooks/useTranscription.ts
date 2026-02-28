import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { createSocket } from '@/lib/api/websocket';

export function useTranscription(
  meetingId: string,
  isRealtimeEnabled: boolean = false,
) {
  const {
    isConnected,
    isTranscriptExpanded,
    error,
    clearTranscripts,
    toggleExpanded,
    setConnected,
    setError,
  } = useTranscriptionStore();

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!meetingId || !isRealtimeEnabled) {
      setConnected(false);
      setError(null);
      clearTranscripts();
      return;
    }

    // same-origin WebSocket 연결 (Next.js rewrite 프록시)
    const socket = createSocket('/ws/transcribe', { meetingId });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('error', (err: { message?: string }) => {
      setError(err.message || 'Transcription error');
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      clearTranscripts();
    };
  }, [
    isRealtimeEnabled,
    meetingId,
    clearTranscripts,
    setConnected,
    setError,
  ]);

  return {
    isConnected,
    isTranscriptExpanded,
    error,
    toggleExpanded,
  };
}