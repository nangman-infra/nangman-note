import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { DataSourceOptions } from 'typeorm';
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
  | 'DB_SSL'
  | 'DB_SSL_REJECT_UNAUTHORIZED'
  | 'DB_POOL_MAX'
  | 'DB_CONNECTION_TIMEOUT_MS'
  | 'DB_IDLE_TIMEOUT_MS'
  | 'DB_STATEMENT_TIMEOUT_MS'
>;

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
    return {
      type: 'postgres',
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL
        ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED }
        : false,
      connectTimeoutMS: env.DB_CONNECTION_TIMEOUT_MS,
      extra: {
        max: env.DB_POOL_MAX,
        idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
        statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
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
  } as TypeOrmModuleOptions;
}
