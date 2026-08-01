import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import { applyGlobalAppConfig } from './bootstrap/apply-global-app-config';
import type { AppEnv } from './shared/config/env.validation';


async function bootstrap() {
  await loadSecrets();

  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.get('PORT', { infer: true }) ?? 3002;
  app.enableShutdownHooks();
  applyGlobalAppConfig(app, configService);

  await app.listen(port);
}

void bootstrap();
