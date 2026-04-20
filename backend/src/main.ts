import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { applyGlobalAppConfig } from './bootstrap/apply-global-app-config';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import type { AppEnv } from './shared/config/env.validation';

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

  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.get('PORT', { infer: true });
  applyGlobalAppConfig(app, configService);

  await app.listen(port);
}

void bootstrap();
