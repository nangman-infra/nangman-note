import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from './shared/config/cors-origin.util';
import type { AppEnv } from './shared/config/env.validation';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { requestContextMiddleware } from './shared/logging/request-context.middleware';
import { HttpRequestLoggingInterceptor } from './shared/interceptors/http-request-logging.interceptor';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

async function bootstrap() {
  // Secrets Manager에서 민감정보를 process.env에 주입 (production only)
  // ⚠️ AppModule은 반드시 loadSecrets() 이후에 import해야 한다.
  //    상단에서 import하면 ConfigModule.forRoot({ validate }) 데코레이터가
  //    모듈 로드 시점에 즉시 실행되어 process.env에 값이 없는 상태로 검증한다.
  await loadSecrets();

  // 동적 import — loadSecrets()가 process.env에 값을 주입한 뒤 모듈 로드
  const { AppModule } = await import('./app.module.js');

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
