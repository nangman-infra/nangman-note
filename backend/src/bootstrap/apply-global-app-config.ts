import {
  ConsoleLogger,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import helmet from 'helmet';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from '../shared/config/cors-origin.util';
import type { AppEnv } from '../shared/config/env.validation';
import { AllExceptionsFilter } from '../shared/filters/all-exceptions.filter';
import { HttpRequestLoggingInterceptor } from '../shared/interceptors/http-request-logging.interceptor';
import { ResponseInterceptor } from '../shared/interceptors/response.interceptor';
import { requestContextMiddleware } from '../shared/logging/request-context.middleware';

/**
 * env 문자열을 Express `trust proxy` 설정값으로 변환.
 * - 'true'/'false' → boolean, 홉 수 → number, 나머지(loopback, IP/CIDR 목록)는 문자열 그대로.
 */
export function parseTrustProxySetting(
  value: string,
): boolean | number | string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return value.trim();
}

export function createHttpCorsOriginHandler(options: {
  allowedOrigins: string[];
  nodeEnv: AppEnv['NODE_ENV'];
}): (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => void {
  return (origin, callback) => {
    const isAllowed = isAllowedCorsOrigin({
      origin,
      allowedOrigins: options.allowedOrigins,
      nodeEnv: options.nodeEnv,
    });
    callback(null, isAllowed);
  };
}

export function applyGlobalAppConfig(
  app: INestApplication,
  configService: ConfigService<AppEnv, true>,
): void {
  app.useLogger(
    new ConsoleLogger('', {
      json: true,
      colors: false,
      compact: true,
    }),
  );

  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const corsOriginConfig = configService.get('CORS_ORIGIN', { infer: true });
  const trustProxy = configService.get('TRUST_PROXY', { infer: true });
  const allowedOrigins = parseAllowedOrigins(corsOriginConfig);
  const corsOriginHandler = createHttpCorsOriginHandler({
    allowedOrigins,
    nodeEnv,
  });

  // 리버스 프록시(NPM → Next.js proxy → Nest) 뒤에서 request.ip / protocol 을 복원.
  // 기본 'loopback' 은 같은 호스트에서 온 X-Forwarded-* 만 신뢰한다.
  const expressApp = app.getHttpAdapter().getInstance() as Express | undefined;
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', parseTrustProxySetting(trustProxy));
  }

  app.use(helmet());
  app.enableCors({
    origin: corsOriginHandler,
    credentials: true,
  });
  app.use(requestContextMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new HttpRequestLoggingInterceptor());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(nodeEnv));
}
