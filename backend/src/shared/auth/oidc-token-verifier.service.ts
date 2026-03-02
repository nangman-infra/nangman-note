import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTPayload } from 'jose';
import { AppEnv } from '../config/env.validation';
import type { AuthUser } from './auth-user.interface';

type JoseModule = typeof import('jose');
type JoseJwtKeyResolver = Parameters<JoseModule['jwtVerify']>[1];

@Injectable()
export class OidcTokenVerifierService {
  private readonly authEnabled: boolean;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwksUri: string;
  private joseModulePromise: Promise<JoseModule> | undefined;
  private jwks: JoseJwtKeyResolver | undefined;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.authEnabled = this.configService.get('AUTH_ENABLED', { infer: true });
    this.issuer = this.configService.get('AUTH_OIDC_ISSUER', { infer: true });
    this.audience = this.configService.get('AUTH_OIDC_AUDIENCE', {
      infer: true,
    });
    this.jwksUri = this.configService.get('AUTH_OIDC_JWKS_URI', {
      infer: true,
    });
  }

  isAuthEnabled(): boolean {
    return this.authEnabled;
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const jose = await this.getJoseModule();
      const { payload } = await jose.jwtVerify(token, await this.getJwks(), {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: 5,
      });

      return this.toAuthUser(payload);
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid access token: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async getJoseModule(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = import('jose');
    }
    return this.joseModulePromise;
  }

  private async getJwks(): Promise<JoseJwtKeyResolver> {
    if (this.jwks) {
      return this.jwks;
    }

    const normalizedIssuer = this.issuer.endsWith('/')
      ? this.issuer
      : `${this.issuer}/`;
    const defaultJwksUri = new URL(
      '.well-known/jwks.json',
      normalizedIssuer,
    ).toString();
    const jwksUri = this.jwksUri.trim() || defaultJwksUri;

    const jose = await this.getJoseModule();
    this.jwks = jose.createRemoteJWKSet(new URL(jwksUri));
    return this.jwks;
  }

  private toAuthUser(payload: JWTPayload): AuthUser {
    const sub = payload.sub?.trim();
    if (!sub) {
      throw new UnauthorizedException('Token subject (sub) is missing');
    }

    const scope =
      typeof payload.scope === 'string'
        ? payload.scope
            .split(' ')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    return {
      sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      scope,
      raw: payload,
    };
  }
}
