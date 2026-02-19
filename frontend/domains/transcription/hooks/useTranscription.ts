import { useEffect, useRef } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { TranscriptionSocket, type TranscriptionStreamMessage } from '@/lib/api/websocket';
import type { TranscriptSegment } from '../types/transcription.types';

function toTranscriptSegment(message: TranscriptionStreamMessage): TranscriptSegment {
  return {
    id: message.id,
    meetingId: message.meetingId,
    startTime: message.startTime,
    endTime: message.endTime,
    text: message.text,
    confidence: message.confidence,
    createdAt: message.createdAt,
  };
}

export function useTranscription(
  meetingId: string,
  isRealtimeEnabled: boolean = false,
) {
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!meetingId || !isRealtimeEnabled) {
      setConnected(false);
      setError(null);
      clearTranscripts();
      return;
    }
    let isDisposed = false;

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

    socketRef.current.onTranscript((segment) => {
      addSegment(toTranscriptSegment(segment));
    });

    socket.on('error', (err) => {
      setError(err.message || 'Transcription error');
    });

    const startAudioCapture = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('현재 브라우저는 마이크 캡처를 지원하지 않습니다.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (isDisposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const preferredMimeType = MediaRecorder.isTypeSupported(
          'audio/webm;codecs=opus',
        )
          ? 'audio/webm;codecs=opus'
          : '';
        const recorder =
          preferredMimeType.length > 0
            ? new MediaRecorder(stream, { mimeType: preferredMimeType })
            : new MediaRecorder(stream);

        recorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size === 0) {
            return;
          }

          try {
            const arrayBuffer = await event.data.arrayBuffer();
            socketRef.current?.sendAudio(arrayBuffer);
          } catch {
            setError('오디오 데이터 전송에 실패했습니다.');
          }
        };
        recorder.onerror = () => {
          setError('마이크 녹음 중 오류가 발생했습니다.');
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1200);
      } catch (captureError) {
        setError(
          captureError instanceof Error
            ? `마이크 권한 오류: ${captureError.message}`
            : '마이크 권한을 확인해주세요.',
        );
      }
    };
    void startAudioCapture();

    // Cleanup
    return () => {
      isDisposed = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      socketRef.current?.disconnect();
      clearTranscripts();
    };
  }, [
    isRealtimeEnabled,
    meetingId,
    addSegment,
    clearTranscripts,
    setConnected,
    setError,
  ]);

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
