import { buildTypeOrmDataSourceOptions } from './typeorm-options.factory';

describe('buildTypeOrmDataSourceOptions', () => {
  it('builds sqljs options for development', () => {
    const options = buildTypeOrmDataSourceOptions({
      NODE_ENV: 'development',
      DB_ENGINE: 'sqljs',
      DB_MIGRATIONS_RUN: false,
      DB_PATH: ':memory:',
      DB_HOST: '',
      DB_PORT: 0,
      DB_NAME: '',
      DB_USER: '',
      DB_PASSWORD: '',
      DB_IAM_AUTH: false,
      DB_SSL: false,
      DB_SSL_REJECT_UNAUTHORIZED: false,
      DB_POOL_MAX: 0,
      DB_CONNECTION_TIMEOUT_MS: 0,
      DB_IDLE_TIMEOUT_MS: 0,
      DB_STATEMENT_TIMEOUT_MS: 0,
    });

    expect(options.type).toBe('sqljs');
    expect(options.synchronize).toBe(true);
    expect(options.migrationsRun).toBe(false);
  });

  it('builds postgres options for production', () => {
    const options = buildTypeOrmDataSourceOptions({
      NODE_ENV: 'production',
      DB_ENGINE: 'postgres',
      DB_MIGRATIONS_RUN: true,
      DB_PATH: './data/prod.db',
      DB_HOST: 'db.example.local',
      DB_PORT: 5432,
      DB_NAME: 'nangman_note',
      DB_USER: 'app_user',
      DB_PASSWORD: 'app_password',
      DB_IAM_AUTH: false,
      DB_SSL: true,
      DB_SSL_REJECT_UNAUTHORIZED: true,
      DB_POOL_MAX: 10,
      DB_CONNECTION_TIMEOUT_MS: 5000,
      DB_IDLE_TIMEOUT_MS: 30000,
      DB_STATEMENT_TIMEOUT_MS: 15000,
    });

    expect(options.type).toBe('postgres');
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
    expect((options as { ssl?: unknown }).ssl).toEqual({
      rejectUnauthorized: true,
    });
    expect((options as { connectTimeoutMS?: number }).connectTimeoutMS).toBe(
      5000,
    );
    expect((options as { extra?: { max?: number } }).extra?.max).toBe(10);
  });
});
