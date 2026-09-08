import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_USER_KEY, IS_PUBLIC_KEY } from './auth.constants';
import { parseBearerAuthorization } from './bearer-token.util';
import { OidcTokenVerifierService } from './oidc-token-verifier.service';
import { updateRequestContext } from '../logging/request-context.storage';

@Injectable()
export class HttpAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: OidcTokenVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'http' | 'ws'>() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (!this.tokenVerifier.isAuthEnabled()) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const accessToken = this.parseBearerToken(
      this.extractAuthorizationHeader(request),
    );
    const user = await this.tokenVerifier.verifyAccessToken(accessToken);

    request[AUTH_USER_KEY] = user;
    request.user = user;
    updateRequestContext({
      ownerSub: user.sub,
    });
    return true;
  }

  private extractAuthorizationHeader(
    request: Record<string, unknown>,
  ): string | undefined {
    const headers = request.headers as Record<string, unknown> | undefined;
    const authorization = headers?.authorization;
    return typeof authorization === 'string' ? authorization : undefined;
  }

  private parseBearerToken(authorization?: string): string {
    const parsed = parseBearerAuthorization(authorization);
    if (parsed.ok) {
      return parsed.token;
    }

    if (parsed.reason === 'missing') {
      throw new UnauthorizedException('Missing Authorization header');
    }
    throw new UnauthorizedException('Authorization header must use Bearer');
  }
}
