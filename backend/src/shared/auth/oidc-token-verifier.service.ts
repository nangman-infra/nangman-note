import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTPayload } from 'jose';
import { AppEnv } from '../config/env.validation';
import type { AuthUser } from './auth-user.interface';

type JoseModule = typeof import('jose');
type JoseJwtKeyResolver = Parameters<JoseModule['jwtVerify']>[1];

@Injectable()
export class OidcTokenVerifierService {
  private readonly logger = new Logger(OidcTokenVerifierService.name);
  private readonly authEnabled: boolean;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwksUri: string;
  private joseModulePromise: Promise<JoseModule> | undefined;
  private discoveredJwksUriPromise: Promise<string> | undefined;
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
      this.logger.warn(
        `Access token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid access token');
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

    const jwksUri = await this.resolveJwksUri();

    const jose = await this.getJoseModule();
    this.jwks = jose.createRemoteJWKSet(new URL(jwksUri));
    return this.jwks;
  }

  private async resolveJwksUri(): Promise<string> {
    const explicitJwksUri = this.jwksUri.trim();
    if (explicitJwksUri.length > 0) {
      return explicitJwksUri;
    }

    if (!this.discoveredJwksUriPromise) {
      this.discoveredJwksUriPromise = this.discoverJwksUri();
    }
    return this.discoveredJwksUriPromise;
  }

  private async discoverJwksUri(): Promise<string> {
    const normalizedIssuer = this.issuer.endsWith('/')
      ? this.issuer
      : `${this.issuer}/`;
    const defaultJwksUri = new URL(
      '.well-known/jwks.json',
      normalizedIssuer,
    ).toString();
    const discoveryUrl = new URL(
      '.well-known/openid-configuration',
      normalizedIssuer,
    ).toString();

    try {
      const response = await fetch(discoveryUrl, { cache: 'no-store' });
      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch OIDC discovery document (${response.status}), fallback to ${defaultJwksUri}`,
        );
        return defaultJwksUri;
      }

      const data = (await response.json()) as { jwks_uri?: string };
      if (
        typeof data.jwks_uri === 'string' &&
        data.jwks_uri.trim().length > 0
      ) {
        return data.jwks_uri.trim();
      }

      this.logger.warn(
        `OIDC discovery document missing jwks_uri, fallback to ${defaultJwksUri}`,
      );
      return defaultJwksUri;
    } catch (error) {
      this.logger.warn(
        `OIDC discovery fetch failed, fallback to ${defaultJwksUri}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return defaultJwksUri;
    }
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
