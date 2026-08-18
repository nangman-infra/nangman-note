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
import { isUUID } from 'class-validator';
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
  private readonly server!: Server;

  private readonly logger = new StructuredLogger(TranscriptionGateway.name);

  /** meetingId → Set<socket.id> (같은 회의에 여러 클라이언트가 연결될 수 있음) */
  private readonly meetingClients = new Map<string, Set<string>>();
  /**
   * meetingId → 오디오 프로듀서 socket.id.
   * 같은 회의에 두 탭이 접속해 서로 다른 마이크의 PCM이 한 세션에
   * 인터리브되는 것을 방지한다 (첫 audio 전송 소켓이 프로듀서가 됨).
   */
  private readonly meetingProducers = new Map<string, string>();
  /** 마지막 클라이언트 disconnect 후 세션 종료 유예 타이머 (재연결 blip 대응) */
  private readonly pendingSessionStops = new Map<string, NodeJS.Timeout>();
  /** meetingId → 최근 세션 시작 실패/스트림 에러 기록 (서킷브레이커) */
  private readonly sessionFailures = new Map<
    string,
    { count: number; lastAt: number }
  >();
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

          // 재연결 blip으로 예약된 세션 종료가 있으면 취소
          const pendingStop = this.pendingSessionStops.get(meetingId);
          if (pendingStop) {
            clearTimeout(pendingStop);
            this.pendingSessionStops.delete(meetingId);
            this.logger.debug(
              'transcription.gateway.session.stop_cancelled_on_reconnect',
              { meetingId, socketId: client.id },
            );
          }

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
      runWithRequestContext(
        {
          transport: 'ws',
          socketId: client.id,
          meetingId,
        },
        () => {
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

  handleDisconnect(client: Socket): void {
    const meetingId = this.resolveMeetingId(client);
    runWithRequestContext(
      {
        transport: 'ws',
        socketId: client.id,
        meetingId,
        ownerSub: this.socketUsers.get(client.id),
      },
      () => {
        this.logger.debug('transcription.gateway.client.disconnected', {
          meetingId,
          socketId: client.id,
        });
      },
    );
    this.socketUsers.delete(client.id);
    this.unregisterSocketAuthExpiry(client.id);

    if (!meetingId) return;

    // 프로듀서 해제 — 재연결 시 새 소켓이 프로듀서를 승계할 수 있게 한다
    if (this.meetingProducers.get(meetingId) === client.id) {
      this.meetingProducers.delete(meetingId);
    }

    // 클라이언트 추적 제거
    const clients = this.meetingClients.get(meetingId);
    if (clients) {
      clients.delete(client.id);

      // 더 이상 연결된 클라이언트가 없으면 유예 후 세션 종료.
      // socket.io 자동 재연결(1~5초) blip마다 AWS 세션을 파괴/재생성하면
      // 핸드셰이크 공백(오디오 유실)과 마지막 final 유실이 반복된다.
      if (clients.size === 0) {
        this.meetingClients.delete(meetingId);
        this.lastBackpressureLogAt.delete(meetingId);

        const GRACE_MS = 10_000;
        const existingTimer = this.pendingSessionStops.get(meetingId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
          this.pendingSessionStops.delete(meetingId);
          const stillEmpty = !this.meetingClients.has(meetingId);
          if (stillEmpty) {
            this.sessionFailures.delete(meetingId);
            this.meetingProducers.delete(meetingId);
          }
          if (
            stillEmpty &&
            this.transcriptionService.hasActiveRealtimeSession(meetingId)
          ) {
            void this.transcriptionService
              .stopRealtimeSession(meetingId)
              .then(() => {
                this.logger.log(
                  'transcription.gateway.session.stopped_no_clients',
                  { meetingId },
                );
              })
              .catch(() => undefined);
          }
        }, GRACE_MS);
        timer.unref?.();
        this.pendingSessionStops.set(meetingId, timer);
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

          // 단일 프로듀서 강제: 같은 회의에 두 탭이 오디오를 보내면
          // 서로 다른 마이크의 PCM이 인터리브되어 전사가 망가진다.
          const producerId = this.meetingProducers.get(meetingId);
          if (producerId === undefined) {
            this.meetingProducers.set(meetingId, client.id);
          } else if (producerId !== client.id) {
            const producerStillConnected = this.meetingClients
              .get(meetingId)
              ?.has(producerId);
            if (producerStillConnected) {
              return { ok: false, reason: 'another-producer-active' };
            }
            // 기존 프로듀서가 끊겼으면 승계
            this.meetingProducers.set(meetingId, client.id);
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

            if (
              !this.transcriptionService.hasActiveRealtimeSession(meetingId)
            ) {
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

    // 서킷브레이커: 세션이 지속적으로 실패하면(자격 증명·리전 오류 등)
    // 200ms마다 들어오는 오디오가 시작→실패를 무한 반복하며 AWS API를
    // 폭주시키는 것을 막는다. 연속 실패 시 배치 폴백으로 전환.
    const CIRCUIT_FAILURE_THRESHOLD = 3;
    const CIRCUIT_RESET_MS = 60_000;
    const failures = this.sessionFailures.get(meetingId);
    if (failures && Date.now() - failures.lastAt > CIRCUIT_RESET_MS) {
      this.sessionFailures.delete(meetingId);
    } else if (failures && failures.count >= CIRCUIT_FAILURE_THRESHOLD) {
      const switchedToBatch =
        await this.transcriptionService.switchMeetingToBatchFallback(
          meetingId,
          ownerSub,
        );
      if (switchedToBatch) {
        this.server.to(meetingId).emit('transcript:fallback', {
          meetingId,
          mode: 'batch',
          reason: 'realtime-session-unstable',
        });
        this.logger.warn('transcription.gateway.circuit_breaker_fallback', {
          meetingId,
          ownerSub,
          failureCount: failures.count,
        });
      }
      return {
        ok: false,
        reason: 'session-start-failed',
        fallbackToBatch: switchedToBatch,
      };
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
          this.recordSessionFailure(meetingId);
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
      this.sessionFailures.delete(meetingId);
      this.server.to(meetingId).emit('connected', {
        meetingId,
        hasActiveSession: true,
      });
      return { ok: true };
    } catch (error) {
      this.recordSessionFailure(meetingId);
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

  private recordSessionFailure(meetingId: string): void {
    const existing = this.sessionFailures.get(meetingId);
    if (existing && Date.now() - existing.lastAt < 60_000) {
      existing.count += 1;
      existing.lastAt = Date.now();
    } else {
      this.sessionFailures.set(meetingId, { count: 1, lastAt: Date.now() });
    }
  }

  private resolveMeetingId(client: Socket): string | undefined {
    const rawValue = client.handshake.query.meetingId;

    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      const candidate = rawValue.trim();
      return isUUID(candidate, 'all') ? candidate : undefined;
    }

    if (Array.isArray(rawValue) && rawValue.length > 0) {
      const candidate = rawValue[0];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        const trimmed = candidate.trim();
        return isUUID(trimmed, 'all') ? trimmed : undefined;
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
