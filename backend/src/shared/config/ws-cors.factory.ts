import { isAllowedCorsOrigin, parseAllowedOrigins } from './cors-origin.util';
import type { AppEnv } from './env.validation';

/**
 * WebSocketGateway 데코레이터에서 사용할 CORS origin 핸들러.
 *
 * @WebSocketGateway 데코레이터는 클래스 로드 시점에 평가되므로
 * ConfigService를 주입할 수 없어 process.env를 직접 참조합니다.
 * handleConnection 단계에서 ConfigService를 이용한 2차 검증을 병행합니다.
 */
export function resolveWsNodeEnv(): AppEnv['NODE_ENV'] {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'test') {
    return nodeEnv;
  }
  return 'development';
}

export function resolveWsAllowedOrigins(): string[] {
  const configured =
    process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000';
  return parseAllowedOrigins(configured);
}

/**
 * WebSocketGateway 데코레이터 cors.origin 에 전달할 핸들러 함수를 반환합니다.
 */
export function createWsCorsOriginHandler(): (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => void {
  return (origin, callback) => {
    const allowedOrigins = resolveWsAllowedOrigins();
    const nodeEnv = resolveWsNodeEnv();
    const allowed = isAllowedCorsOrigin({
      origin,
      allowedOrigins,
      nodeEnv,
      allowWithoutOrigin: false,
    });

    if (allowed) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed'));
  };
}
