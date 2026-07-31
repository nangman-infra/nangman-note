import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { applyGlobalAppConfig } from './bootstrap/apply-global-app-config';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import type { AppEnv } from './shared/config/env.validation';

async function bootstrap() {
  await loadSecrets();

  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.get('PORT', { infer: true });
  app.enableShutdownHooks();
  applyGlobalAppConfig(app, configService);

  await app.listen(port);
}

void bootstrap();
