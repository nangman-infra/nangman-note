import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env.validation';
import {
  buildAcceptedIssuers,
  type JoseLoader,
  OidcTokenVerifierService,
} from './oidc-token-verifier.service';

const ISSUER = 'https://auth.example.com/application/o/transnote/';
const JWKS_URI = 'https://auth.example.com/application/o/transnote/jwks/';

type EnvOverrides = Partial<
  Pick<
    AppEnv,
    | 'AUTH_ENABLED'
    | 'AUTH_OIDC_ISSUER'
    | 'AUTH_OIDC_AUDIENCE'
    | 'AUTH_OIDC_JWKS_URI'
    | 'AUTH_OIDC_ALGORITHMS'
  >
>;

function createConfig(
  overrides: EnvOverrides = {},
): ConfigService<AppEnv, true> {
  const values: EnvOverrides = {
    AUTH_ENABLED: true,
    AUTH_OIDC_ISSUER: ISSUER,
    AUTH_OIDC_AUDIENCE: 'client-id',
    AUTH_OIDC_JWKS_URI: '',
    AUTH_OIDC_ALGORITHMS: ['RS256'],
    ...overrides,
  };
  return {
    get: jest.fn((key: keyof EnvOverrides) => values[key]),
  } as unknown as ConfigService<AppEnv, true>;
}

function createFakeJose() {
  const jwtVerify = jest.fn();
  const createRemoteJWKSet = jest.fn((url: URL) => ({ jwksUrl: url.href }));
  return {
    module: {
      jwtVerify,
      createRemoteJWKSet,
    } as unknown as typeof import('jose'),
    jwtVerify,
    createRemoteJWKSet,
  };
}

function loaderFor(jose: ReturnType<typeof createFakeJose>) {
  return () => Promise.resolve(jose.module);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('buildAcceptedIssuers', () => {
  it('accepts both trailing-slash and slash-less forms', () => {
    expect(buildAcceptedIssuers(ISSUER)).toEqual([ISSUER, ISSUER.slice(0, -1)]);
    expect(buildAcceptedIssuers(ISSUER.slice(0, -1))).toEqual([
      ISSUER.slice(0, -1),
      ISSUER,
    ]);
  });

  it('returns an empty list for an empty issuer', () => {
    expect(buildAcceptedIssuers('')).toEqual([]);
  });
});

describe('OidcTokenVerifierService', () => {
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('rejects an empty token before touching the network', async () => {
    const jose = createFakeJose();
    const service = new OidcTokenVerifierService(
      createConfig(),
      loaderFor(jose),
    );

    await expect(service.verifyAccessToken('  ')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the explicit JWKS URI and verifies with the configured algorithms/issuers', async () => {
    const jose = createFakeJose();
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: ' user-1 ',
        email: 'u@example.com',
        scope: 'openid profile',
      },
    });
    const service = new OidcTokenVerifierService(
      createConfig({
        AUTH_OIDC_JWKS_URI: JWKS_URI,
        AUTH_OIDC_ALGORITHMS: ['RS256', 'ES256'],
      }),
      loaderFor(jose),
    );

    const user = await service.verifyAccessToken('token');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(JWKS_URI));
    expect(jose.jwtVerify).toHaveBeenCalledWith(
      'token',
      { jwksUrl: JWKS_URI },
      expect.objectContaining({
        issuer: [ISSUER, ISSUER.slice(0, -1)],
        audience: 'client-id',
        algorithms: ['RS256', 'ES256'],
        clockTolerance: 5,
      }),
    );
    expect(user).toMatchObject({
      sub: 'user-1',
      email: 'u@example.com',
      scope: ['openid', 'profile'],
    });
  });

  it('discovers jwks_uri from the issuer and caches the resolver', async () => {
    const jose = createFakeJose();
    jose.jwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } });
    fetchMock.mockResolvedValue(jsonResponse({ jwks_uri: JWKS_URI }));
    const service = new OidcTokenVerifierService(
      createConfig(),
      loaderFor(jose),
    );

    await service.verifyAccessToken('a');
    await service.verifyAccessToken('b');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${ISSUER}.well-known/openid-configuration`,
    );
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);
  });

  it('fails closed when discovery fails and retries after the cooldown instead of caching the failure', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const jose = createFakeJose();
    jose.jwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'down' }, 503))
      .mockResolvedValueOnce(jsonResponse({ jwks_uri: JWKS_URI }));
    const service = new OidcTokenVerifierService(
      createConfig(),
      loaderFor(jose),
    );

    // 1) discovery 503 → 401, 추측 URL 로 대체하지 않음
    await expect(service.verifyAccessToken('a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jose.createRemoteJWKSet).not.toHaveBeenCalled();

    // 2) cooldown 중에는 네트워크를 다시 두드리지 않고 바로 401
    await expect(service.verifyAccessToken('a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3) cooldown 이후 재시도 → 성공
    jest.setSystemTime(1_000_000 + 6_000);
    await expect(service.verifyAccessToken('a')).resolves.toMatchObject({
      sub: 'user-1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(JWKS_URI));
  });

  it('retries the jose module import after a rejected load instead of caching it forever', async () => {
    jest.useFakeTimers({ now: 2_000_000 });
    const jose = createFakeJose();
    jose.jwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } });
    const loader = jest
      .fn<ReturnType<JoseLoader>, Parameters<JoseLoader>>()
      .mockRejectedValueOnce(new Error('temporary ESM loader failure'))
      .mockResolvedValue(jose.module);
    const service = new OidcTokenVerifierService(
      createConfig({ AUTH_OIDC_JWKS_URI: JWKS_URI }),
      loader,
    );

    await expect(service.verifyAccessToken('a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    jest.setSystemTime(2_006_000);
    await expect(service.verifyAccessToken('b')).resolves.toMatchObject({
      sub: 'user-1',
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the discovery document has no jwks_uri', async () => {
    const jose = createFakeJose();
    fetchMock.mockResolvedValue(jsonResponse({ issuer: ISSUER }));
    const service = new OidcTokenVerifierService(
      createConfig(),
      loaderFor(jose),
    );

    await expect(service.verifyAccessToken('a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jose.createRemoteJWKSet).not.toHaveBeenCalled();
  });

  it('maps jose verification errors to 401 Invalid access token', async () => {
    const jose = createFakeJose();
    const joseError = Object.assign(
      new Error('"exp" claim timestamp check failed'),
      {
        code: 'ERR_JWT_EXPIRED',
      },
    );
    jose.jwtVerify.mockRejectedValue(joseError);
    const service = new OidcTokenVerifierService(
      createConfig({ AUTH_OIDC_JWKS_URI: JWKS_URI }),
      loaderFor(jose),
    );

    await expect(service.verifyAccessToken('expired')).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Invalid access token',
    });
  });

  it('rejects tokens without a subject', async () => {
    const jose = createFakeJose();
    jose.jwtVerify.mockResolvedValue({ payload: { sub: '   ' } });
    const service = new OidcTokenVerifierService(
      createConfig({ AUTH_OIDC_JWKS_URI: JWKS_URI }),
      loaderFor(jose),
    );

    await expect(service.verifyAccessToken('no-sub')).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Token subject (sub) is missing',
    });
  });

  it('reports whether auth is enabled', () => {
    const jose = createFakeJose();
    expect(
      new OidcTokenVerifierService(
        createConfig({ AUTH_ENABLED: false }),
        loaderFor(jose),
      ).isAuthEnabled(),
    ).toBe(false);
    expect(
      new OidcTokenVerifierService(
        createConfig(),
        loaderFor(jose),
      ).isAuthEnabled(),
    ).toBe(true);
  });
});
