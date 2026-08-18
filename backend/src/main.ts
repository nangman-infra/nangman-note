import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { applyGlobalAppConfig } from './bootstrap/apply-global-app-config';
import { loadSecrets } from './shared/aws/secrets-manager/secrets-loader';
import { StructuredLogger } from './shared/logging/structured-logger';
import type { AppEnv } from './shared/config/env.validation';

/**
 * 프로세스 레벨 안전망.
 * fire-and-forget 경로의 catch 블록 안에서 2차 실패가 발생하면 unhandled
 * rejection이 되는데, Node 기본 정책은 프로세스를 종료시킨다. 프로세스가
 * 죽으면 진행 중이던 전사 폴링·복구 루프가 전부 유실되므로, rejection은
 * 로그만 남기고 프로세스를 유지한다. (uncaughtException은 상태가 오염됐을
 * 수 있어 로그 후 종료 — 컨테이너 오케스트레이터가 재시작)
 */
function registerProcessSafetyHandlers(): void {
  const logger = new StructuredLogger('ProcessSafety');

  process.on('unhandledRejection', (reason) => {
    logger.error(
      'process.unhandled_rejection',
      reason instanceof Error ? reason : new Error(String(reason)),
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', error);
    process.exitCode = 1;
    // 즉시 종료하지 않고 이벤트 루프가 비면 종료되도록 한다.
    setTimeout(() => process.exit(1), 1000).unref();
  });
}

async function bootstrap() {
  registerProcessSafetyHandlers();

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
  app.enableShutdownHooks();
  applyGlobalAppConfig(app, configService);

  await app.listen(port);
}

void bootstrap();
