import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { AppEnv } from '../../../shared/config/env.validation';
import { OidcTokenVerifierService } from '../../../shared/auth/oidc-token-verifier.service';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';
import { MeetingService } from '../../meeting/application/meeting.service';
import { TranscriptionService } from '../application/transcription.service';
import { TranscriptionGateway } from './transcription.gateway';

type MockSocket = Pick<
  Socket,
  'handshake' | 'emit' | 'id' | 'join' | 'disconnect'
>;

describe('TranscriptionGateway', () => {
  let gateway: TranscriptionGateway;
  let transcriptionService: jest.Mocked<
    Pick<
      TranscriptionService,
      | 'hasActiveRealtimeSession'
      | 'getActiveRealtimeSessionCount'
      | 'switchMeetingToBatchFallback'
      | 'startRealtimeSession'
      | 'feedRealtimeAudio'
      | 'isRealtimeSessionReady'
      | 'stopRealtimeSession'
    >
  >;
  let configService: jest.Mocked<Pick<ConfigService<AppEnv, true>, 'get'>>;
  let tokenVerifier: jest.Mocked<
    Pick<OidcTokenVerifierService, 'isAuthEnabled' | 'verifyAccessToken'>
  >;
  let meetingService: jest.Mocked<Pick<MeetingService, 'findById'>>;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;

  const createSocket = (meetingId?: string): MockSocket =>
    ({
      id: 'socket-1',
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
    transcriptionService = {
      hasActiveRealtimeSession: jest.fn().mockReturnValue(true),
      getActiveRealtimeSessionCount: jest.fn().mockReturnValue(0),
      switchMeetingToBatchFallback: jest.fn().mockResolvedValue(false),
      startRealtimeSession: jest.fn().mockResolvedValue(undefined),
      feedRealtimeAudio: jest.fn().mockReturnValue(true),
      isRealtimeSessionReady: jest.fn().mockReturnValue(true),
      stopRealtimeSession: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn((key: keyof AppEnv) => {
        if (key === 'REALTIME_MAX_CONCURRENT_SESSIONS') return 2;
        if (key === 'REALTIME_MAX_AUDIO_CHUNK_BYTES') return 1024;
        if (key === 'REALTIME_BACKPRESSURE_RETRY_MS') return 200;
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

    gateway = new TranscriptionGateway(
      transcriptionService as unknown as TranscriptionService,
      meetingService as unknown as MeetingService,
      tokenVerifier as unknown as OidcTokenVerifierService,
      configService as unknown as ConfigService<AppEnv, true>,
    );

    serverEmit = jest.fn();
    serverTo = jest.fn().mockReturnValue({ emit: serverEmit });
    (gateway as unknown as { server: { to: jest.Mock } }).server = {
      to: serverTo,
    };
  });

  it('returns invalid response when meetingId is missing', async () => {
    const response = await gateway.handleAudio(
      createSocket() as unknown as Socket,
      Buffer.from([1, 2, 3]),
    );

    expect(response).toEqual({ ok: false, reason: 'missing-meeting-id' });
  });

  it('rejects oversized chunks with retry hint', async () => {
    const response = await gateway.handleAudio(
      createSocket('meeting-1') as unknown as Socket,
      Buffer.alloc(8192, 1),
    );

    expect(response.ok).toBe(false);
    expect(response.reason).toBe('chunk-too-large');
    expect(response.retryAfterMs).toBe(200);
  });

  it('returns backpressure when provider queue is full', async () => {
    transcriptionService.feedRealtimeAudio.mockReturnValue(false);

    const response = await gateway.handleAudio(
      createSocket('meeting-1') as unknown as Socket,
      Buffer.from([1, 2, 3]),
    );

    expect(response).toEqual({
      ok: false,
      reason: 'backpressure',
      retryAfterMs: 200,
    });
  });

  it('returns session-warming when queue is full before stream is ready', async () => {
    transcriptionService.feedRealtimeAudio.mockReturnValue(false);
    transcriptionService.isRealtimeSessionReady.mockReturnValue(false);

    const response = await gateway.handleAudio(
      createSocket('meeting-1') as unknown as Socket,
      Buffer.from([1, 2, 3]),
    );

    expect(response).toEqual({
      ok: false,
      reason: 'session-warming',
      retryAfterMs: 200,
    });
  });

  it('switches to batch fallback when realtime capacity is exceeded', async () => {
    transcriptionService.hasActiveRealtimeSession.mockReturnValue(false);
    transcriptionService.getActiveRealtimeSessionCount.mockReturnValue(2);
    transcriptionService.switchMeetingToBatchFallback.mockResolvedValue(true);

    const response = await gateway.handleAudio(
      createSocket('meeting-1') as unknown as Socket,
      Buffer.from([1, 2, 3]),
    );

    expect(response).toEqual({
      ok: false,
      reason: 'realtime-capacity-exceeded',
      fallbackToBatch: true,
      mode: 'batch',
      retryAfterMs: 200,
    });
    expect(serverTo).toHaveBeenCalledWith('meeting-1');
    expect(serverEmit).toHaveBeenCalledWith('transcript:fallback', {
      meetingId: 'meeting-1',
      mode: 'batch',
      reason: 'realtime-capacity-exceeded',
    });
  });

  it('starts session on first audio and accepts chunk', async () => {
    transcriptionService.hasActiveRealtimeSession.mockReturnValue(false);
    transcriptionService.getActiveRealtimeSessionCount.mockReturnValue(1);

    const response = await gateway.handleAudio(
      createSocket('meeting-1') as unknown as Socket,
      Buffer.from([1, 2, 3]),
    );

    expect(response).toEqual({ ok: true });
    expect(transcriptionService.startRealtimeSession).toHaveBeenCalledTimes(1);
    expect(transcriptionService.feedRealtimeAudio).toHaveBeenCalledWith(
      'meeting-1',
      expect.any(Buffer),
    );
    expect(serverEmit).toHaveBeenCalledWith('connected', {
      meetingId: 'meeting-1',
      hasActiveSession: true,
    });
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
    expect(socket.join).toHaveBeenCalledWith('meeting-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
