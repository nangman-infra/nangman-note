import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { createSocket } from '@/lib/api/websocket';
import type { RealtimeTranscriptPayload } from '../types/transcription.types';

export function useTranscription(
  meetingId: string,
  isRealtimeEnabled: boolean = false,
) {
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

  useEffect(() => {
    if (!meetingId || !isRealtimeEnabled) {
      setConnected(false);
      setHasActiveSession(false);
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

    socket.on('transcript:error', (err: { message?: string }) => {
      setError(err.message || 'Transcription stream error');
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
    handlePayload,
    setConnected,
    setHasActiveSession,
    setError,
  ]);

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
    /** socket.io 인스턴스 (useAudioStreaming에서 사용) */
    socketRef,
  };
}