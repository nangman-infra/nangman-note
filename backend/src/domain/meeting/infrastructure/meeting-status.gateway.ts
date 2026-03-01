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

  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  async handleConnection(client: Socket): Promise<void> {
    if (!this.isAllowedOrigin(client.handshake.headers.origin)) {
      client.emit('error', { message: 'Origin is not allowed' });
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

    await client.join(meetingId);
    this.logger.debug(
      `Client ${client.id} joined meeting-status room: ${meetingId}`,
    );
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
    this.logger.log(
      `Broadcasting status change: meeting=${event.meetingId}, status=${event.status}`,
    );
    this.server.to(event.meetingId).emit('meeting:status', {
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
}
