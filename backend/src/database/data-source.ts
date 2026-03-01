import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { MeetingEntity } from '../domain/meeting/domain/meeting.entity';
import { NoteEntity } from '../domain/note/domain/note.entity';
import { PromptEntity } from '../domain/prompt/domain/prompt.entity';
import { ResultEntity } from '../domain/result/domain/result.entity';
import { TranscriptSegmentEntity } from '../domain/transcription/domain/transcript-segment.entity';
import { TranscriptionJobEntity } from '../domain/transcription/domain/transcription-job.entity';
import { validateEnv } from '../shared/config/env.validation';
import { buildTypeOrmDataSourceOptions } from '../shared/config/typeorm-options.factory';

const env = validateEnv(process.env as Record<string, unknown>);

const dataSourceOptions = buildTypeOrmDataSourceOptions({
  NODE_ENV: env.NODE_ENV,
  DB_ENGINE: env.DB_ENGINE,
  DB_MIGRATIONS_RUN: env.DB_MIGRATIONS_RUN,
  DB_PATH: env.DB_PATH,
  DB_HOST: env.DB_HOST,
  DB_PORT: env.DB_PORT,
  DB_NAME: env.DB_NAME,
  DB_USER: env.DB_USER,
  DB_PASSWORD: env.DB_PASSWORD,
  DB_SSL: env.DB_SSL,
  DB_SSL_REJECT_UNAUTHORIZED: env.DB_SSL_REJECT_UNAUTHORIZED,
  DB_POOL_MAX: env.DB_POOL_MAX,
  DB_CONNECTION_TIMEOUT_MS: env.DB_CONNECTION_TIMEOUT_MS,
  DB_IDLE_TIMEOUT_MS: env.DB_IDLE_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS: env.DB_STATEMENT_TIMEOUT_MS,
});

export default new DataSource({
  ...dataSourceOptions,
  entities: [
    PromptEntity,
    MeetingEntity,
    NoteEntity,
    ResultEntity,
    TranscriptSegmentEntity,
    TranscriptionJobEntity,
  ],
});
