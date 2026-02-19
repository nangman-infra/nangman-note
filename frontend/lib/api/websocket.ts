import { io, Socket } from 'socket.io-client';
import type { TranscriptSegment } from '@/domains/transcription/types/transcription.types';

export class TranscriptionSocket {
  private socket: Socket | null = null;

  connect(meetingId: string): Socket {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      path: '/ws/transcribe',
      query: { meetingId },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return this.socket;
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('audio', audioData);
    }
  }

  onTranscript(callback: (segment: TranscriptSegment) => void) {
    if (this.socket) {
      this.socket.on('transcript', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
