import { useEffect, useRef } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { TranscriptionSocket } from '@/lib/api/websocket';

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

  const socketRef = useRef<TranscriptionSocket | null>(null);

  useEffect(() => {
    if (!meetingId || !isRealtimeEnabled) {
      setConnected(false);
      setError(null);
      clearTranscripts();
      return;
    }

    // WebSocket 연결
    socketRef.current = new TranscriptionSocket();
    const socket = socketRef.current.connect(meetingId);

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('error', (err) => {
      setError(err.message || 'Transcription error');
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
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
