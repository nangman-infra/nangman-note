import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import { AppModule } from './app.module';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from './shared/config/cors-origin.util';
import { AppEnv } from './shared/config/env.validation';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { requestContextMiddleware } from './shared/logging/request-context.middleware';
import { HttpRequestLoggingInterceptor } from './shared/interceptors/http-request-logging.interceptor';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

async function bootstrap() {
  // Secrets Manager에서 민감정보를 process.env에 주입 (production only)
  await loadSecrets();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(
    new ConsoleLogger('', {
      json: true,
      colors: false,
      compact: true,
    }),
  );

  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.get('PORT', { infer: true });
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
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
}

void bootstrap();
