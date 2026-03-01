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
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from '../../../shared/config/cors-origin.util';
import { createWsCorsOriginHandler } from '../../../shared/config/ws-cors.factory';
import { Server, Socket } from 'socket.io';
import {
  TranscriptionService,
  type RealtimeTranscriptPayload,
} from '../application/transcription.service';

@WebSocketGateway({
  path: '/ws/transcribe',
  cors: {
    origin: createWsCorsOriginHandler(),
    credentials: true,
  },
})
export class TranscriptionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);

  /** meetingId → Set<socket.id> (같은 회의에 여러 클라이언트가 연결될 수 있음) */
  private readonly meetingClients = new Map<string, Set<string>>();

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
      await client.join(meetingId);

      // 클라이언트 추적
      if (!this.meetingClients.has(meetingId)) {
        this.meetingClients.set(meetingId, new Set());
      }
      this.meetingClients.get(meetingId)!.add(client.id);

      // Transcribe 세션은 첫 오디오 청크 도착 시 시작 (handleAudio에서)
      // 여기서는 연결만 확인
      client.emit('connected', {
        meetingId,
        hasActiveSession:
          this.transcriptionService.hasActiveRealtimeSession(meetingId),
      });

      this.logger.log(
        `Client ${client.id} connected to meeting ${meetingId} (realtime ready)`,
      );
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

  async handleDisconnect(client: Socket): Promise<void> {
    const meetingId = this.resolveMeetingId(client);
    this.logger.debug(`Socket disconnected: ${client.id}`);

    if (!meetingId) return;

    // 클라이언트 추적 제거
    const clients = this.meetingClients.get(meetingId);
    if (clients) {
      clients.delete(client.id);

      // 더 이상 연결된 클라이언트가 없으면 세션 종료
      if (clients.size === 0) {
        this.meetingClients.delete(meetingId);
        if (this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
          await this.transcriptionService.stopRealtimeSession(meetingId);
          this.logger.log(
            `Realtime session stopped (no clients) for meeting ${meetingId}`,
          );
        }
      }
    }
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

    try {
      const chunk = this.toBuffer(payload);
      if (!chunk || chunk.length === 0) {
        return { ok: true };
      }

      // 첫 오디오 청크가 도착하면 Transcribe 세션 시작
      if (!this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
        try {
          await this.transcriptionService.startRealtimeSession(
            meetingId,
            (transcriptPayload: RealtimeTranscriptPayload) => {
              this.emitToMeeting(meetingId, transcriptPayload);
            },
            (error: Error) => {
              this.server.to(meetingId).emit('transcript:error', {
                message: error.message,
              });
            },
            () => {
              this.logger.debug(
                `Streaming session closed for meeting ${meetingId}`,
              );
              // 세션이 닫히면 클라이언트에게 알림
              this.server.to(meetingId).emit('transcript:session-ended', {
                meetingId,
              });
            },
          );

          this.logger.log(
            `Realtime session started on first audio for meeting ${meetingId}`,
          );

          // 세션 시작을 클라이언트에게 알림
          this.server.to(meetingId).emit('connected', {
            meetingId,
            hasActiveSession: true,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to start realtime session for meeting ${meetingId}: ${error instanceof Error ? error.message : error}`,
          );
          client.emit('transcript:error', {
            message:
              error instanceof Error
                ? error.message
                : 'Failed to start transcription session',
          });
          return { ok: false };
        }
      }

      // 오디오 청크를 streaming provider에 전달
      this.transcriptionService.feedRealtimeAudio(meetingId, chunk);
      return { ok: true };
    } catch (error) {
      client.emit('transcript:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process audio chunk',
      });
      return { ok: false };
    }
  }

  @SubscribeMessage('transcript:stop')
  async handleStopSession(
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean }> {
    const meetingId = this.resolveMeetingId(client);
    if (!meetingId) {
      return { ok: false };
    }

    try {
      if (this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
        await this.transcriptionService.stopRealtimeSession(meetingId);
      }

      this.server.to(meetingId).emit('connected', {
        meetingId,
        hasActiveSession: false,
      });
      this.server.to(meetingId).emit('transcript:session-ended', { meetingId });
      return { ok: true };
    } catch (error) {
      client.emit('transcript:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to stop transcription session',
      });
      return { ok: false };
    }
  }

  /**
   * 특정 회의에 전사 결과를 emit
   */
  private emitToMeeting(
    meetingId: string,
    payload: RealtimeTranscriptPayload,
  ): void {
    const eventName =
      payload.type === 'partial'
        ? 'transcript:partial'
        : payload.type === 'final'
          ? 'transcript:final'
          : 'transcript:translation';
    this.server.to(meetingId).emit(eventName, payload);
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

  private toBuffer(payload: unknown): Buffer | null {
    if (Buffer.isBuffer(payload)) return payload;
    if (payload instanceof Uint8Array) return Buffer.from(payload);
    if (payload instanceof ArrayBuffer) return Buffer.from(payload);
    if (typeof payload === 'string') {
      try {
        return Buffer.from(payload, 'base64');
      } catch {
        return null;
      }
    }
    return null;
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
