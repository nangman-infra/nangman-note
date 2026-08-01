import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { DataSourceOptions } from 'typeorm';
import { Signer } from '@aws-sdk/rds-signer';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AppEnv } from './env.validation';

export type DatabaseEnv = Pick<
  AppEnv,
  | 'NODE_ENV'
  | 'DB_ENGINE'
  | 'DB_MIGRATIONS_RUN'
  | 'DB_PATH'
  | 'DB_HOST'
  | 'DB_PORT'
  | 'DB_NAME'
  | 'DB_USER'
  | 'DB_PASSWORD'
  | 'DB_IAM_AUTH'
  | 'DB_SSL'
  | 'DB_SSL_REJECT_UNAUTHORIZED'
  | 'DB_POOL_MAX'
  | 'DB_CONNECTION_TIMEOUT_MS'
  | 'DB_IDLE_TIMEOUT_MS'
  | 'DB_STATEMENT_TIMEOUT_MS'
> & {
  AWS_REGION?: string;
};

/**
 * node-postgres Pool의 password 콜백 생성.
 * 새 DB 연결이 필요할 때마다 IAM auth 토큰을 실시간 발급한다.
 * 토큰 수명은 15분이지만 세션 수립에만 쓰이므로 기존 연결에 영향 없다.
 */
function createIamPasswordCallback(options: {
  hostname: string;
  port: number;
  username: string;
  region: string;
}): () => Promise<string> {
  const signer = new Signer({
    hostname: options.hostname,
    port: options.port,
    username: options.username,
    region: options.region,
    credentials: fromNodeProviderChain(),
  });

  return async () => {
    const token = await signer.getAuthToken();
    return token;
  };
}

const MIGRATIONS_GLOB = join(__dirname, '../../database/migrations/*{.ts,.js}');

function resolveSqljsDatabasePath(dbPath: string): string {
  if (dbPath === ':memory:') {
    return dbPath;
  }

  const resolved = resolve(process.cwd(), dbPath);
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
}

export function buildTypeOrmDataSourceOptions(
  env: DatabaseEnv,
): DataSourceOptions {
  const logging = env.NODE_ENV === 'development';

  if (env.DB_ENGINE === 'postgres') {
    // IAM DB auth가 활성화되면 password 대신 콜백 함수를 사용한다.
    // node-postgres Pool은 새 연결마다 이 콜백을 호출하여 IAM 토큰을 받는다.
    const useIamAuth = env.DB_IAM_AUTH;

    const passwordOrCallback = useIamAuth
      ? createIamPasswordCallback({
          hostname: env.DB_HOST,
          port: env.DB_PORT,
          username: env.DB_USER,
          region: env.AWS_REGION ?? 'ap-northeast-2',
        })
      : undefined;

    return {
      type: 'postgres',
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      // IAM auth 시에는 password를 비워두고 extra.password 콜백으로 대체
      password: useIamAuth ? '' : env.DB_PASSWORD,
      database: env.DB_NAME,
      // IAM DB auth는 SSL 필수
      ssl:
        env.DB_SSL || useIamAuth
          ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED }
          : false,
      connectTimeoutMS: env.DB_CONNECTION_TIMEOUT_MS,
      extra: {
        max: env.DB_POOL_MAX,
        idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
        statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
        // RDS가 idle 연결을 끊어도 풀이 자동 감지하도록 TCP keepalive 활성화
        keepAlive: true,
        keepAliveInitialDelayMillis: 30_000,
        // IAM auth: 새 연결마다 호출되는 password 콜백
        ...(useIamAuth && passwordOrCallback
          ? { password: passwordOrCallback }
          : {}),
      },
      synchronize: false,
      logging,
      migrations: [MIGRATIONS_GLOB],
      migrationsRun: env.DB_MIGRATIONS_RUN,
      migrationsTableName: 'typeorm_migrations',
      uuidExtension: 'pgcrypto',
    };
  }

  const resolvedDbPath = resolveSqljsDatabasePath(env.DB_PATH);
  return {
    type: 'sqljs',
    location: resolvedDbPath === ':memory:' ? undefined : resolvedDbPath,
    autoSave: resolvedDbPath !== ':memory:',
    synchronize: true,
    logging,
    migrations: [],
    migrationsRun: false,
  };
}

export function buildTypeOrmModuleOptions(
  env: DatabaseEnv,
): TypeOrmModuleOptions {
  return {
    ...buildTypeOrmDataSourceOptions(env),
    autoLoadEntities: true,
    // DB 연결 실패 시 자동 재시도 (ECS 시작 시 RDS가 아직 준비 안 됐을 때 대비)
    retryAttempts: 5,
    retryDelay: 3000,
  } as TypeOrmModuleOptions;
}
