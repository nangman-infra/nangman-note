import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { AppEnv } from '../../../shared/config/env.validation';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from '../../../shared/config/cors-origin.util';
import { Socket } from 'socket.io';
import { TranscriptionService } from '../application/transcription.service';

function resolveNodeEnv(): AppEnv['NODE_ENV'] {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'test') {
    return nodeEnv;
  }
  return 'development';
}

function resolveAllowedWsOrigins(): string[] {
  const configured =
    process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000';
  return parseAllowedOrigins(configured);
}

@WebSocketGateway({
  path: '/ws/transcribe',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = resolveAllowedWsOrigins();
      const nodeEnv = resolveNodeEnv();
      const allowed = isAllowedCorsOrigin({
        origin,
        allowedOrigins,
        nodeEnv,
        allowWithoutOrigin: false,
      });

      if (allowed) {
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

    const processed = await this.transcriptionService
      .acceptRealtimeAudioChunk(meetingId, payload)
      .catch((error: unknown): null => {
        client.emit('error', {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to process realtime transcription chunk',
        });
        return null;
      });
    if (!processed) {
      return { ok: false };
    }

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
    const allowedOrigins = parseAllowedOrigins(
      this.configService.get('CORS_ORIGIN', { infer: true }),
    );
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    return isAllowedCorsOrigin({
      origin,
      allowedOrigins,
      nodeEnv,
      allowWithoutOrigin: false,
    });
  }
}
