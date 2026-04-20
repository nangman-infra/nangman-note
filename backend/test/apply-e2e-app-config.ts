import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applyGlobalAppConfig } from '../src/bootstrap/apply-global-app-config';
import type { AppEnv } from '../src/shared/config/env.validation';

export function applyE2eAppConfig(app: INestApplication): void {
  const configService = app.get<ConfigService<AppEnv, true>>(ConfigService);
  applyGlobalAppConfig(app, configService);
}
