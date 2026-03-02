import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppEnv } from '../../../shared/config/env.validation';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from '../../../shared/config/cors-origin.util';
import { createWsCorsOriginHandler } from '../../../shared/config/ws-cors.factory';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';
import { OidcTokenVerifierService } from '../../../shared/auth/oidc-token-verifier.service';
import { MeetingService } from '../application/meeting.service';

@WebSocketGateway({
  path: '/ws/meeting-status',
  cors: {
    origin: createWsCorsOriginHandler(),
    credentials: true,
  },
})
export class MeetingStatusGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MeetingStatusGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly tokenVerifier: OidcTokenVerifierService,
    private readonly meetingService: MeetingService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    if (!this.isAllowedOrigin(client.handshake.headers.origin)) {
      client.emit('error', { message: 'Origin is not allowed' });
      client.disconnect(true);
      return;
    }

    try {
      const userSub = await this.resolveSocketOwnerSub(client);
      await client.join(this.userRoom(userSub));

      const meetingId = this.resolveMeetingId(client);
      if (meetingId) {
        await this.meetingService.findById(meetingId, userSub);
      }

      this.logger.debug(
        `Client ${client.id} joined meeting-status room (owner=${userSub ?? 'anonymous'})`,
      );
    } catch (error) {
      client.emit('error', {
        message:
          error instanceof Error
            ? error.message
            : 'Meeting status socket authentication failed',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client ${client.id} disconnected from meeting-status`);
  }

  /**
   * EventEmitter 를 통해 도메인 이벤트를 수신하고,
   * 해당 meetingId 룸에 WebSocket 메시지를 브로드캐스트합니다.
   */
  @OnEvent(MeetingStatusChangedEvent.EVENT_NAME)
  handleMeetingStatusChanged(event: MeetingStatusChangedEvent): void {
    const ownerSub = event.ownerSub;

    this.logger.log(
      `Broadcasting status change: meeting=${event.meetingId}, status=${event.status}, owner=${ownerSub ?? 'anonymous'}`,
    );
    this.server.to(this.userRoom(ownerSub)).emit('meeting:status', {
      meetingId: event.meetingId,
      status: event.status,
      phase: event.phase,
    });
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

  private userRoom(ownerSub?: string): string {
    return `meeting-status:user:${ownerSub ?? 'anonymous'}`;
  }

  private async resolveSocketOwnerSub(
    client: Socket,
  ): Promise<string | undefined> {
    if (!this.tokenVerifier.isAuthEnabled()) {
      return undefined;
    }

    const token = this.extractSocketToken(client);
    if (!token) {
      throw new Error('Missing socket auth token');
    }
    const user = await this.tokenVerifier.verifyAccessToken(token);
    return user.sub;
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

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    return undefined;
  }
}
