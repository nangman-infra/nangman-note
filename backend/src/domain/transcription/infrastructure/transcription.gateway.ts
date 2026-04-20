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
import { MeetingService } from '../../meeting/application/meeting.service';
import { OidcTokenVerifierService } from '../../../shared/auth/oidc-token-verifier.service';
import {
  runWithRequestContext,
  updateRequestContext,
} from '../../../shared/logging/request-context.storage';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

interface AudioAckResponse {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
  fallbackToBatch?: boolean;
  mode?: 'batch';
}

interface EnsureSessionResult {
  ok: boolean;
  reason?: 'realtime-capacity-exceeded' | 'session-start-failed';
  fallbackToBatch?: boolean;
}

interface SocketAuthContext {
  ownerSub?: string;
  expiresAtMs?: number;
}

@WebSocketGateway({
  path: '/ws/transcribe',
  cors: {
    origin: createWsCorsOriginHandler(),
    credentials: true,
  },
  // ARTS 참조: WebSocket 안정성 설정
  transports: ['websocket'],
  pingTimeout: 10000,
  pingInterval: 5000,
  maxHttpBufferSize: 1e6, // 1MB — 오디오 청크 최대 크기
})
export class TranscriptionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new StructuredLogger(TranscriptionGateway.name);

  /** meetingId → Set<socket.id> (같은 회의에 여러 클라이언트가 연결될 수 있음) */
  private readonly meetingClients = new Map<string, Set<string>>();
  /** socket.id → ownerSub */
  private readonly socketUsers = new Map<string, string | undefined>();
  /** socket.id → access token exp(ms) */
  private readonly socketAuthExpiresAt = new Map<string, number>();
  /** socket.id → access token expiry disconnect timer */
  private readonly socketAuthExpiryTimers = new Map<string, NodeJS.Timeout>();
  /** 세션 시작 중 중복 호출 방지 락 */
  private readonly startingSession = new Set<string>();
  private readonly maxConcurrentRealtimeSessions: number;
  private readonly maxAudioChunkBytes: number;
  private readonly backpressureRetryMs: number;
  private readonly lastBackpressureLogAt = new Map<string, number>();

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly meetingService: MeetingService,
    private readonly tokenVerifier: OidcTokenVerifierService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    this.maxConcurrentRealtimeSessions = Math.max(
      1,
      this.configService.get('REALTIME_MAX_CONCURRENT_SESSIONS', {
        infer: true,
      }) || 8,
    );
    this.maxAudioChunkBytes = Math.max(
      4 * 1024,
      this.configService.get('REALTIME_MAX_AUDIO_CHUNK_BYTES', {
        infer: true,
      }) || 64 * 1024,
    );
    this.backpressureRetryMs = Math.max(
      50,
      this.configService.get('REALTIME_BACKPRESSURE_RETRY_MS', {
        infer: true,
      }) || 200,
    );
  }

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
      await runWithRequestContext(
        {
          transport: 'ws',
          socketId: client.id,
          meetingId,
        },
        async () => {
          const authContext = await this.resolveSocketAuthContext(client);
          const ownerSub = authContext?.ownerSub;
          updateRequestContext({ ownerSub });
          await this.meetingService.findById(meetingId, ownerSub);
          await client.join(meetingId);
          this.socketUsers.set(client.id, ownerSub);
          this.registerSocketAuthExpiry(client, authContext?.expiresAtMs);

          if (!this.meetingClients.has(meetingId)) {
            this.meetingClients.set(meetingId, new Set());
          }
          this.meetingClients.get(meetingId)!.add(client.id);

          client.emit('connected', {
            meetingId,
            hasActiveSession:
              this.transcriptionService.hasActiveRealtimeSession(meetingId),
          });

          this.logger.log('transcription.gateway.client.connected', {
            meetingId,
            socketId: client.id,
            ownerSub,
          });
        },
      );
    } catch (error) {
      await runWithRequestContext(
        {
          transport: 'ws',
          socketId: client.id,
          meetingId,
        },
        async () => {
          this.logger.warn('transcription.gateway.client.connection_failed', {
            meetingId,
            socketId: client.id,
            errorMessage:
              error instanceof Error ? error.message : 'Invalid meeting id',
          });
          client.emit('error', {
            message:
              error instanceof Error ? error.message : 'Invalid meeting id',
          });
          client.disconnect(true);
        },
      );
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meetingId = this.resolveMeetingId(client);
    await runWithRequestContext(
      {
        transport: 'ws',
        socketId: client.id,
        meetingId,
        ownerSub: this.socketUsers.get(client.id),
      },
      async () => {
        this.logger.debug('transcription.gateway.client.disconnected', {
          meetingId,
          socketId: client.id,
        });
      },
    );
    this.socketUsers.delete(client.id);
    this.unregisterSocketAuthExpiry(client.id);

    if (!meetingId) return;

    // 클라이언트 추적 제거
    const clients = this.meetingClients.get(meetingId);
    if (clients) {
      clients.delete(client.id);

      // 더 이상 연결된 클라이언트가 없으면 세션 종료
      if (clients.size === 0) {
        this.meetingClients.delete(meetingId);
        this.lastBackpressureLogAt.delete(meetingId);
        if (this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
          await this.transcriptionService.stopRealtimeSession(meetingId);
          this.logger.log('transcription.gateway.session.stopped_no_clients', {
            meetingId,
          });
        }
      }
    }
  }

  @SubscribeMessage('audio')
  async handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<AudioAckResponse> {
    const meetingId = this.resolveMeetingId(client);
    if (!meetingId) {
      return { ok: false, reason: 'missing-meeting-id' };
    }

    if (this.isSocketAuthExpired(client.id)) {
      this.disconnectExpiredSocket(client);
      return { ok: false, reason: 'auth-expired' };
    }

    const ownerSub = this.socketUsers.get(client.id);

    try {
      return await runWithRequestContext(
        {
          transport: 'ws',
          socketId: client.id,
          meetingId,
          ownerSub,
        },
        async () => {
          const chunk = this.toBuffer(payload);
          if (!chunk || chunk.length === 0) {
            return { ok: true };
          }
          if (chunk.length > this.maxAudioChunkBytes) {
            return {
              ok: false,
              reason: 'chunk-too-large',
              retryAfterMs: this.backpressureRetryMs,
            };
          }

          const sessionStart = await this.ensureRealtimeSessionStarted(
            meetingId,
            ownerSub,
          );
          if (!sessionStart.ok) {
            return {
              ok: false,
              reason: sessionStart.reason,
              fallbackToBatch: sessionStart.fallbackToBatch,
              mode: sessionStart.fallbackToBatch ? 'batch' : undefined,
              retryAfterMs: this.backpressureRetryMs,
            };
          }

          const accepted = this.transcriptionService.feedRealtimeAudio(
            meetingId,
            chunk,
          );
          if (!accepted) {
            if (!this.transcriptionService.isRealtimeSessionReady(meetingId)) {
              return {
                ok: false,
                reason: 'session-warming',
                retryAfterMs: this.backpressureRetryMs,
              };
            }

            if (!this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
              return {
                ok: false,
                reason: 'session-start-failed',
                retryAfterMs: this.backpressureRetryMs,
              };
            }

            this.logBackpressure(meetingId);
            return {
              ok: false,
              reason: 'backpressure',
              retryAfterMs: this.backpressureRetryMs,
            };
          }
          return { ok: true };
        },
      );
    } catch (error) {
      this.logger.warn('transcription.gateway.audio.processing_failed', {
        meetingId,
        socketId: client.id,
        ownerSub,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to process audio chunk',
      });
      client.emit('transcript:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process audio chunk',
      });
      return { ok: false, reason: 'audio-processing-failed' };
    }
  }

  @SubscribeMessage('transcript:stop')
  async handleStopSession(
    @ConnectedSocket() client: Socket,
  ): Promise<AudioAckResponse> {
    const meetingId = this.resolveMeetingId(client);
    if (!meetingId) {
      return { ok: false };
    }

    if (this.isSocketAuthExpired(client.id)) {
      this.disconnectExpiredSocket(client);
      return { ok: false, reason: 'auth-expired' };
    }

    const ownerSub = this.socketUsers.get(client.id);

    try {
      return await runWithRequestContext(
        {
          transport: 'ws',
          socketId: client.id,
          meetingId,
          ownerSub,
        },
        async () => {
          await this.meetingService.findById(meetingId, ownerSub);
          if (this.transcriptionService.hasActiveRealtimeSession(meetingId)) {
            await this.transcriptionService.stopRealtimeSession(meetingId);
          }
          this.transcriptionService.clearRealtimeTimeOffset(meetingId);

          this.server.to(meetingId).emit('connected', {
            meetingId,
            hasActiveSession: false,
          });
          this.server.to(meetingId).emit('transcript:session-ended', {
            meetingId,
          });
          this.logger.log('transcription.gateway.session.stopped_explicit', {
            meetingId,
            socketId: client.id,
            ownerSub,
          });
          return { ok: true };
        },
      );
    } catch (error) {
      this.logger.warn('transcription.gateway.session.stop_failed', {
        meetingId,
        socketId: client.id,
        ownerSub,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to stop transcription session',
      });
      client.emit('transcript:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to stop transcription session',
      });
      return { ok: false, reason: 'stop-session-failed' };
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

  private async ensureRealtimeSessionStarted(
    meetingId: string,
    ownerSub?: string,
  ): Promise<EnsureSessionResult> {
    if (
      this.transcriptionService.hasActiveRealtimeSession(meetingId) ||
      this.startingSession.has(meetingId)
    ) {
      return { ok: true };
    }

    const activeSessionCount =
      this.transcriptionService.getActiveRealtimeSessionCount();
    if (activeSessionCount >= this.maxConcurrentRealtimeSessions) {
      const switchedToBatch =
        await this.transcriptionService.switchMeetingToBatchFallback(
          meetingId,
          ownerSub,
        );

      if (switchedToBatch) {
        this.server.to(meetingId).emit('transcript:fallback', {
          meetingId,
          mode: 'batch',
          reason: 'realtime-capacity-exceeded',
        });
        this.server.to(meetingId).emit('connected', {
          meetingId,
          hasActiveSession: false,
        });
        this.logger.warn('transcription.gateway.capacity_fallback', {
          meetingId,
          ownerSub,
        });
      }

      return {
        ok: false,
        reason: 'realtime-capacity-exceeded',
        fallbackToBatch: switchedToBatch,
      };
    }

    this.startingSession.add(meetingId);
    try {
      await this.transcriptionService.startRealtimeSession(
        meetingId,
        (transcriptPayload: RealtimeTranscriptPayload) => {
          this.emitToMeeting(meetingId, transcriptPayload);
        },
        (error: Error) => {
          this.logger.warn('transcription.gateway.session.stream_error', {
            meetingId,
            ownerSub,
            errorMessage: error.message,
          });
          this.server.to(meetingId).emit('transcript:error', {
            message: error.message,
          });
        },
        () => {
          this.logger.debug('transcription.gateway.session.closed', {
            meetingId,
            ownerSub,
          });
          this.server.to(meetingId).emit('transcript:session-ended', {
            meetingId,
          });
        },
        ownerSub,
      );

      this.logger.log('transcription.gateway.session.started', {
        meetingId,
        ownerSub,
      });
      this.server.to(meetingId).emit('connected', {
        meetingId,
        hasActiveSession: true,
      });
      return { ok: true };
    } catch (error) {
      this.logger.warn('transcription.gateway.session.start_failed', {
        meetingId,
        ownerSub,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      this.server.to(meetingId).emit('transcript:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to start transcription session',
      });
      return { ok: false, reason: 'session-start-failed' };
    } finally {
      this.startingSession.delete(meetingId);
    }
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

  private logBackpressure(meetingId: string): void {
    const now = Date.now();
    const previous = this.lastBackpressureLogAt.get(meetingId) ?? 0;
    if (now - previous < 3000) {
      return;
    }

    this.lastBackpressureLogAt.set(meetingId, now);
    this.logger.warn('transcription.gateway.backpressure', {
      meetingId,
      retryAfterMs: this.backpressureRetryMs,
    });
  }

  private async resolveSocketAuthContext(
    client: Socket,
  ): Promise<SocketAuthContext | undefined> {
    if (!this.tokenVerifier.isAuthEnabled()) {
      return undefined;
    }

    const token = this.extractSocketToken(client);
    if (!token) {
      throw new Error('Missing socket auth token');
    }

    const user = await this.tokenVerifier.verifyAccessToken(token);
    const expiresAtMs =
      typeof user.raw.exp === 'number' ? user.raw.exp * 1000 : undefined;

    return {
      ownerSub: user.sub,
      expiresAtMs,
    };
  }

  private extractSocketToken(client: Socket): string | undefined {
    const authPayload = client.handshake.auth as
      | Record<string, unknown>
      | undefined;
    const fromAuth = authPayload?.token;
    if (typeof fromAuth === 'string' && fromAuth.trim().length > 0) {
      return fromAuth.trim();
    }

    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string') {
      const [scheme, credentials] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && credentials) {
        return credentials.trim();
      }
    }

    return undefined;
  }

  private registerSocketAuthExpiry(client: Socket, expiresAtMs?: number): void {
    this.unregisterSocketAuthExpiry(client.id);

    if (!expiresAtMs) {
      return;
    }

    this.socketAuthExpiresAt.set(client.id, expiresAtMs);

    const disconnectDelayMs = expiresAtMs - Date.now() + 1000;
    if (disconnectDelayMs <= 0) {
      this.disconnectExpiredSocket(client);
      return;
    }

    const timer = setTimeout(() => {
      this.disconnectExpiredSocket(client);
    }, disconnectDelayMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    this.socketAuthExpiryTimers.set(client.id, timer);
  }

  private unregisterSocketAuthExpiry(clientId: string): void {
    const timer = this.socketAuthExpiryTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.socketAuthExpiryTimers.delete(clientId);
    }
    this.socketAuthExpiresAt.delete(clientId);
  }

  private isSocketAuthExpired(clientId: string): boolean {
    const expiresAtMs = this.socketAuthExpiresAt.get(clientId);
    return typeof expiresAtMs === 'number' && Date.now() >= expiresAtMs;
  }

  private disconnectExpiredSocket(client: Socket): void {
    this.logger.warn('transcription.gateway.socket.auth_expired', {
      socketId: client.id,
      meetingId: this.resolveMeetingId(client),
      ownerSub: this.socketUsers.get(client.id),
    });
    client.emit('error', { message: 'Authentication expired' });
    client.disconnect(true);
  }
}
