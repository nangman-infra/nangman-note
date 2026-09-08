import {
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTPayload } from 'jose';
import { AppEnv } from '../config/env.validation';
import { ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS } from './auth.constants';
import type { AuthUser } from './auth-user.interface';
import { StructuredLogger } from '../logging/structured-logger';

type JoseModule = typeof import('jose');
type JoseJwtKeyResolver = Parameters<JoseModule['jwtVerify']>[1];

/**
 * jose 는 ESM 전용 패키지라 CommonJS 런타임에서는 동적 import 로만 로드할 수 있다.
 * 로더를 주입 가능하게 두어 단위 테스트에서 가짜 구현으로 대체할 수 있게 한다.
 */
export type JoseLoader = () => Promise<JoseModule>;
export const JOSE_LOADER = Symbol('JOSE_LOADER');
export const defaultJoseLoader: JoseLoader = () => import('jose');

/** discovery 실패 후 재시도까지 최소 대기 (IdP 장애 시 요청마다 discovery 를 두드리지 않도록) */
const DISCOVERY_RETRY_COOLDOWN_MS = 5_000;
const DISCOVERY_TIMEOUT_MS = 5_000;

/**
 * issuer 는 정확히 일치해야 하지만, 설정값의 후행 슬래시 유무로 전체 인증이 실패하는
 * 사고를 막기 위해 두 표기를 모두 허용한다. (Authentik 은 `.../application/o/<slug>/` 형태)
 */
export function buildAcceptedIssuers(issuer: string): string[] {
  const trimmed = issuer.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const withoutSlash = trimmed.replace(/\/+$/, '');
  return Array.from(new Set([trimmed, withoutSlash, `${withoutSlash}/`]));
}

@Injectable()
export class OidcTokenVerifierService implements OnModuleInit {
  private readonly logger = new StructuredLogger(OidcTokenVerifierService.name);
  private readonly authEnabled: boolean;
  private readonly issuer: string;
  private readonly acceptedIssuers: string[];
  private readonly audience: string;
  private readonly jwksUri: string;
  private readonly algorithms: string[];
  private joseModulePromise: Promise<JoseModule> | undefined;
  private jwksPromise: Promise<JoseJwtKeyResolver> | undefined;
  private discoveryBlockedUntil = 0;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    @Optional()
    @Inject(JOSE_LOADER)
    private readonly joseLoader: JoseLoader = defaultJoseLoader,
  ) {
    this.authEnabled = this.configService.get('AUTH_ENABLED', { infer: true });
    this.issuer = this.configService.get('AUTH_OIDC_ISSUER', { infer: true });
    this.acceptedIssuers = buildAcceptedIssuers(this.issuer);
    this.audience = this.configService.get('AUTH_OIDC_AUDIENCE', {
      infer: true,
    });
    this.jwksUri = this.configService.get('AUTH_OIDC_JWKS_URI', {
      infer: true,
    });
    this.algorithms = this.configService.get('AUTH_OIDC_ALGORITHMS', {
      infer: true,
    });
  }

  onModuleInit(): void {
    if (!this.authEnabled) {
      // 인증이 꺼지면 ownerSub 가 없어 모든 데이터 격리(테넌시)가 해제된다. 운영자가 반드시 인지해야 함.
      this.logger.warn('auth.disabled', {
        message:
          'AUTH_ENABLED=false — all requests are anonymous and tenant scoping is bypassed. Never use outside local development.',
      });
      return;
    }

    this.logger.log('auth.oidc.configured', {
      issuer: this.issuer,
      audience: this.audience,
      jwksUri: this.jwksUri.trim().length > 0 ? this.jwksUri : '(discovery)',
      algorithms: this.algorithms,
    });
  }

  isAuthEnabled(): boolean {
    return this.authEnabled;
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException('Missing access token');
    }

    let jwks: JoseJwtKeyResolver;
    try {
      jwks = await this.getJwks();
    } catch (error) {
      // JWKS 를 못 구하면 어떤 토큰도 검증할 수 없다 → fail closed.
      // 실패 원인은 운영 이슈이므로 토큰 오류와 구분되는 이벤트로 남긴다.
      this.logger.error('auth.oidc.jwks.unavailable', error);
      throw new UnauthorizedException('Invalid access token');
    }

    try {
      const jose = await this.getJoseModule();
      const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: this.acceptedIssuers,
        audience: this.audience,
        algorithms: this.algorithms,
        clockTolerance: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
      });

      return this.toAuthUser(payload);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('auth.oidc.access_token.invalid', {
        errorCode:
          typeof (error as { code?: unknown })?.code === 'string'
            ? (error as { code: string }).code
            : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async getJoseModule(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = this.joseLoader();
    }
    return this.joseModulePromise;
  }

  /**
   * JWKS resolver 는 성공 시에만 캐시한다. (jose 의 createRemoteJWKSet 이 키 회전/재조회를 내부 처리)
   * discovery 실패는 캐시하지 않고 짧은 cooldown 후 다음 요청에서 다시 시도한다 —
   * 기동 직후 일시적 네트워크 오류가 프로세스 수명 동안 401 로 고착되는 것을 막는다.
   */
  private async getJwks(): Promise<JoseJwtKeyResolver> {
    if (this.jwksPromise) {
      return this.jwksPromise;
    }

    const now = Date.now();
    if (now < this.discoveryBlockedUntil) {
      throw new Error(
        `JWKS discovery is cooling down after a failure (retry in ${Math.ceil(
          (this.discoveryBlockedUntil - now) / 1000,
        )}s)`,
      );
    }

    const pending = (async (): Promise<JoseJwtKeyResolver> => {
      const jwksUri = await this.resolveJwksUri();
      const jose = await this.getJoseModule();
      return jose.createRemoteJWKSet(new URL(jwksUri));
    })();

    this.jwksPromise = pending;
    try {
      return await pending;
    } catch (error) {
      this.jwksPromise = undefined;
      this.discoveryBlockedUntil = Date.now() + DISCOVERY_RETRY_COOLDOWN_MS;
      throw error;
    }
  }

  private async resolveJwksUri(): Promise<string> {
    const explicitJwksUri = this.jwksUri.trim();
    if (explicitJwksUri.length > 0) {
      return explicitJwksUri;
    }

    return this.discoverJwksUri();
  }

  private async discoverJwksUri(): Promise<string> {
    const normalizedIssuer = this.issuer.endsWith('/')
      ? this.issuer
      : `${this.issuer}/`;
    const discoveryUrl = new URL(
      '.well-known/openid-configuration',
      normalizedIssuer,
    ).toString();

    const response = await fetch(discoveryUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `OIDC discovery failed (${response.status}) at ${discoveryUrl}`,
      );
    }

    const data = (await response.json()) as { jwks_uri?: unknown };
    if (
      typeof data.jwks_uri !== 'string' ||
      data.jwks_uri.trim().length === 0
    ) {
      // 표준상 jwks_uri 는 필수. 추측한 URL 로 대체하면 조용히 영구 401 이 되므로 명시적으로 실패시킨다.
      throw new Error(
        `OIDC discovery document at ${discoveryUrl} has no jwks_uri; set AUTH_OIDC_JWKS_URI explicitly`,
      );
    }

    this.logger.log('auth.oidc.discovery.resolved', {
      jwksUri: data.jwks_uri.trim(),
    });
    return data.jwks_uri.trim();
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
