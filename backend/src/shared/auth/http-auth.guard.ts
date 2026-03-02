import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_USER_KEY, IS_PUBLIC_KEY } from './auth.constants';
import { OidcTokenVerifierService } from './oidc-token-verifier.service';

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
    const authorization = this.extractAuthorizationHeader(request);
    const accessToken = this.parseBearerToken(authorization);
    const user = await this.tokenVerifier.verifyAccessToken(accessToken);

    request[AUTH_USER_KEY] = user;
    request.user = user;
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
    if (!authorization) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, credentials] = authorization.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !credentials) {
      throw new UnauthorizedException('Authorization header must use Bearer');
    }

    return credentials;
  }
}
