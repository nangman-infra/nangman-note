import {
  ConsoleLogger,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  const allowedOrigins = parseAllowedOrigins(corsOriginConfig);
  const corsOriginHandler = (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ): void => {
    const isAllowed = isAllowedCorsOrigin({
      origin,
      allowedOrigins,
      nodeEnv,
    });
    callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
  };

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
