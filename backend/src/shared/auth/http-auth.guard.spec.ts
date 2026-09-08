import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_USER_KEY } from './auth.constants';
import type { AuthUser } from './auth-user.interface';
import { HttpAuthGuard } from './http-auth.guard';
import { OidcTokenVerifierService } from './oidc-token-verifier.service';

function createContext(options: {
  type?: 'http' | 'ws';
  headers?: Record<string, unknown>;
  isPublic?: boolean;
}): {
  context: ExecutionContext;
  request: Record<string, unknown>;
  reflector: Reflector;
} {
  const request: Record<string, unknown> = { headers: options.headers ?? {} };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.isPublic ?? false),
  } as unknown as Reflector;

  const context = {
    getType: () => options.type ?? 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request, reflector };
}

describe('HttpAuthGuard', () => {
  const user: AuthUser = { sub: 'user-1', scope: [], raw: { sub: 'user-1' } };
  let tokenVerifier: {
    isAuthEnabled: jest.Mock;
    verifyAccessToken: jest.Mock;
  };

  beforeEach(() => {
    tokenVerifier = {
      isAuthEnabled: jest.fn().mockReturnValue(true),
      verifyAccessToken: jest.fn().mockResolvedValue(user),
    };
  });

  function createGuard(reflector: Reflector): HttpAuthGuard {
    return new HttpAuthGuard(
      reflector,
      tokenVerifier as unknown as OidcTokenVerifierService,
    );
  }

  it('skips non-http contexts', async () => {
    const { context, reflector } = createContext({ type: 'ws' });

    await expect(createGuard(reflector).canActivate(context)).resolves.toBe(
      true,
    );
    expect(tokenVerifier.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('allows @Public handlers without a token', async () => {
    const { context, reflector } = createContext({ isPublic: true });

    await expect(createGuard(reflector).canActivate(context)).resolves.toBe(
      true,
    );
    expect(tokenVerifier.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('allows everything when auth is disabled', async () => {
    tokenVerifier.isAuthEnabled.mockReturnValue(false);
    const { context, reflector, request } = createContext({});

    await expect(createGuard(reflector).canActivate(context)).resolves.toBe(
      true,
    );
    expect(request[AUTH_USER_KEY]).toBeUndefined();
  });

  it('rejects a missing Authorization header', async () => {
    const { context, reflector } = createContext({});

    await expect(
      createGuard(reflector).canActivate(context),
    ).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Missing Authorization header',
    });
  });

  it('rejects non-Bearer schemes', async () => {
    const { context, reflector } = createContext({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    await expect(
      createGuard(reflector).canActivate(context),
    ).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Authorization header must use Bearer',
    });
  });

  it('accepts a Bearer token with irregular spacing and attaches the user', async () => {
    const { context, reflector, request } = createContext({
      headers: { authorization: 'bearer   the-token' },
    });

    await expect(createGuard(reflector).canActivate(context)).resolves.toBe(
      true,
    );
    expect(tokenVerifier.verifyAccessToken).toHaveBeenCalledWith('the-token');
    expect(request[AUTH_USER_KEY]).toBe(user);
    expect(request.user).toBe(user);
  });

  it('propagates verifier failures', async () => {
    tokenVerifier.verifyAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );
    const { context, reflector } = createContext({
      headers: { authorization: 'Bearer bad' },
    });

    await expect(
      createGuard(reflector).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
