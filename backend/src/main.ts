import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppEnv } from './shared/config/env.validation';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

function isAllowedCorsOrigin(params: {
  origin: string | undefined;
  allowedOrigins: string[];
  nodeEnv: AppEnv['NODE_ENV'];
}): boolean {
  const { origin, allowedOrigins, nodeEnv } = params;

  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return true;
  }

  if (nodeEnv !== 'production') {
    try {
      const parsed = new URL(origin);
      if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.get('PORT', { infer: true });
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const corsOriginConfig = configService.get('CORS_ORIGIN', { infer: true });
  const allowedOrigins = corsOriginConfig
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
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
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
}

void bootstrap();
