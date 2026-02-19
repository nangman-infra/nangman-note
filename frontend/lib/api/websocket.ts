import { io, Socket } from 'socket.io-client';
import { env } from '@/lib/config/env';

export interface TranscriptionStreamMessage {
  id: string;
  meetingId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  createdAt: string;
}

export class TranscriptionSocket {
  private socket: Socket | null = null;

  connect(meetingId: string): Socket {
    this.socket = io(env.WS_URL, {
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

  onTranscript(callback: (segment: TranscriptionStreamMessage) => void) {
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
