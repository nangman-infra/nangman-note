import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';
import { OidcTokenVerifierService } from '../../../shared/auth/oidc-token-verifier.service';
import { AppEnv } from '../../../shared/config/env.validation';
import { MeetingService } from '../application/meeting.service';
import { MeetingStatusGateway } from './meeting-status.gateway';

type MockSocket = Pick<
  Socket,
  'id' | 'handshake' | 'emit' | 'join' | 'disconnect'
>;

describe('MeetingStatusGateway', () => {
  let gateway: MeetingStatusGateway;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let configService: any;
  let tokenVerifier: jest.Mocked<
    Pick<OidcTokenVerifierService, 'isAuthEnabled' | 'verifyAccessToken'>
  >;
  let meetingService: jest.Mocked<Pick<MeetingService, 'findById'>>;

  const createSocket = (meetingId?: string): MockSocket =>
    ({
      id: 'socket-status-1',
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      handshake: {
        query: meetingId ? { meetingId } : {},
        headers: {
          origin: 'http://localhost:3000',
        },
        auth: {},
      },
    }) as unknown as MockSocket;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: keyof AppEnv) => {
        if (key === 'CORS_ORIGIN') return 'http://localhost:3000';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    tokenVerifier = {
      isAuthEnabled: jest.fn().mockReturnValue(false),
      verifyAccessToken: jest.fn(),
    };

    meetingService = {
      findById: jest.fn(),
    };

    gateway = new MeetingStatusGateway(
      configService as unknown as ConfigService<AppEnv, true>,
      tokenVerifier as unknown as OidcTokenVerifierService,
      meetingService as unknown as MeetingService,
    );
  });

  it('rejects query token when auth is enabled', async () => {
    tokenVerifier.isAuthEnabled.mockReturnValue(true);
    const socket = createSocket('meeting-1');
    socket.handshake.query = { meetingId: 'meeting-1', token: 'query-token' };

    await gateway.handleConnection(socket as unknown as Socket);

    expect(tokenVerifier.verifyAccessToken).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('accepts handshake auth token when auth is enabled', async () => {
    tokenVerifier.isAuthEnabled.mockReturnValue(true);
    tokenVerifier.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      scope: [],
      raw: {
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    } as AuthUser);

    const socket = createSocket('meeting-1');
    socket.handshake.auth = { token: 'auth-token' };

    await gateway.handleConnection(socket as unknown as Socket);

    expect(tokenVerifier.verifyAccessToken).toHaveBeenCalledWith('auth-token');
    expect(meetingService.findById).toHaveBeenCalledWith('meeting-1', 'user-1');
    expect(socket.join).toHaveBeenCalledWith('meeting-status:user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();

    gateway.handleDisconnect(socket as unknown as Socket);
  });
});
