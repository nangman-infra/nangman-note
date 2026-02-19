import { useEffect, useRef } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { TranscriptionSocket } from '@/lib/api/websocket';

export function useTranscription(meetingId: string) {
  const {
    transcripts,
    isConnected,
    isTranscriptExpanded,
    error,
    addSegment,
    clearTranscripts,
    toggleExpanded,
    setConnected,
    setError,
  } = useTranscriptionStore();

  const socketRef = useRef<TranscriptionSocket | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    // WebSocket 연결
    socketRef.current = new TranscriptionSocket();
    const socket = socketRef.current.connect(meetingId);

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('transcript', (segment) => {
      addSegment(segment);
    });

    socket.on('error', (err) => {
      setError(err.message || 'Transcription error');
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
      clearTranscripts();
    };
  }, [meetingId, addSegment, clearTranscripts, setConnected, setError]);

  const sendAudio = (audioData: ArrayBuffer) => {
    socketRef.current?.sendAudio(audioData);
  };

  return {
    transcripts,
    isConnected,
    isTranscriptExpanded,
    error,
    toggleExpanded,
    sendAudio,
  };
}
