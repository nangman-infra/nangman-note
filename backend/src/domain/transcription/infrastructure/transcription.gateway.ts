import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AppEnv } from '../../../shared/config/env.validation';
import { Server, Socket } from 'socket.io';
import { TranscriptionService } from '../application/transcription.service';

function resolveAllowedWsOrigins(): string[] {
  return (
    process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  path: '/ws/transcribe',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = resolveAllowedWsOrigins();

      if (!origin) {
        callback(new Error('Origin is required for websocket connection'));
        return;
      }

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed'));
    },
    credentials: true,
  },
  transports: ['websocket'],
})
export class TranscriptionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    if (!this.isAllowedOrigin(client.handshake.headers.origin)) {
      client.emit('error', {
        message: 'Origin is not allowed',
      });
      client.disconnect(true);
      return;
    }

    const meetingId = this.resolveMeetingId(client);

    if (!meetingId) {
      client.emit('error', {
        message: 'meetingId query parameter is required',
      });
      client.disconnect(true);
      return;
    }

    try {
      await this.transcriptionService.ensureRealtimeEnabled(meetingId);
      await this.transcriptionService.listByMeetingId(meetingId);
      await client.join(meetingId);
    } catch (error) {
      this.logger.warn(
        `Failed to connect socket ${client.id} to meeting ${meetingId}`,
      );
      client.emit('error', {
        message: error instanceof Error ? error.message : 'Invalid meeting id',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('audio')
  async handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ ok: boolean }> {
    const meetingId = this.resolveMeetingId(client);
    if (!meetingId) {
      return { ok: false };
    }

    const segment = await this.transcriptionService
      .createMockSegmentFromAudio(meetingId, payload)
      .catch((error: unknown): null => {
        client.emit('error', {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to process realtime transcription chunk',
        });
        return null;
      });
    if (!segment) {
      return { ok: false };
    }

    this.server.to(meetingId).emit('transcript', {
      id: segment.id,
      meetingId: segment.meetingId,
      startTime: segment.startTime,
      endTime: segment.endTime,
      text: segment.text,
      confidence: segment.confidence,
      createdAt: segment.createdAt.toISOString(),
    });

    return { ok: true };
  }

  private resolveMeetingId(client: Socket): string | undefined {
    const rawValue = client.handshake.query.meetingId;

    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      return rawValue.trim();
    }

    if (Array.isArray(rawValue) && rawValue.length > 0) {
      const candidate = rawValue[0];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return undefined;
  }

  private isAllowedOrigin(
    originHeader: string | string[] | undefined,
  ): boolean {
    const allowedOrigins = this.configService
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    if (!origin) {
      return false;
    }

    if (allowedOrigins.includes('*')) {
      return true;
    }

    return allowedOrigins.includes(origin);
  }
}
