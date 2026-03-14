# Nangman Note Backend

NestJS backend organized by domain modules (DDD-style), with shared app concerns in `src/shared/*`.

## Stack

- NestJS 11
- TypeORM 0.3
- SQL.js (SQLite-compatible)
- Socket.IO gateway for transcription stream

## Structure

```txt
src/
  domain/
    meeting/
    prompt/
    note/
    result/
    transcription/
  shared/
    config/
    filters/
    interceptors/
```

## Environment

Environment validation is centralized in:

- `src/shared/config/env.validation.ts`

Example env files:

- `.env.development.example`
- `.env.production.example`

Runtime load order:

1. `.env.${NODE_ENV}`
2. `.env`

Required/used variables:

- `PORT`
- `NODE_ENV` (`development` | `test` | `production`)
- `DB_ENGINE` (`sqljs` | `postgres`)
- `DB_MIGRATIONS_RUN` (`true` | `false`)
- `DB_PATH`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL` (`true` | `false`)
- `DB_SSL_REJECT_UNAUTHORIZED` (`true` | `false`)
- `DB_POOL_MAX` (default: `10`)
- `DB_CONNECTION_TIMEOUT_MS` (default: `5000`)
- `DB_IDLE_TIMEOUT_MS` (default: `30000`)
- `DB_STATEMENT_TIMEOUT_MS` (default: `15000`)
- `ENCRYPTION_KEY`
- `AWS_REGION`
- `AWS_PROFILE`
- `AWS_TRANSCRIBE_JOB_PREFIX`
- `AWS_TRANSCRIBE_LANGUAGE_CODE`
- `AWS_TRANSCRIBE_OUTPUT_BUCKET`
- `AWS_TRANSCRIBE_MEDIA_FORMAT`
- `AWS_S3_AUDIO_BUCKET`
- `AWS_S3_AUDIO_KEY_PREFIX`
- `AWS_BEDROCK_MODEL_ID`
- `AWS_BEDROCK_MAX_TOKENS`
- `AWS_BEDROCK_TEMPERATURE` (`0` ~ `1`, default recommended: `0`)
- `REALTIME_MAX_CONCURRENT_SESSIONS` (default: `8`)
- `REALTIME_MAX_BUFFERED_AUDIO_BYTES` (default: `4194304`)
- `REALTIME_MAX_AUDIO_CHUNK_BYTES` (default: `65536`)
- `REALTIME_BACKPRESSURE_RETRY_MS` (default: `200`)
- `PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS` (`1` ~ `8`, default: `2`)
- `LOG_LEVEL`
- `CORS_ORIGIN` (comma-separated)

Recommended mode:

- Development: `DB_ENGINE=sqljs` (file-based local DB)
- Production: `DB_ENGINE=postgres` (RDS/Aurora) + `DB_MIGRATIONS_RUN=true`

Operational BP (PostgreSQL):

- Keep `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=true` in production.
- Tune connection pool/timeouts via DB_* timeout variables before scaling app instances.

## Run

```bash
pnpm install
pnpm start:dev
```

Build and quality:

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Migrations (PostgreSQL):

```bash
# DB_ENGINE=postgres 환경에서 실행
pnpm migration:show
pnpm migration:run
pnpm migration:revert
```

## API

- `GET /` (hello)
- `GET /health` (DB connectivity check)

### Meeting

- `POST /api/v1/meetings`
- `GET /api/v1/meetings`
- `GET /api/v1/meetings/search`
- `GET /api/v1/meetings/:id`
- `PATCH /api/v1/meetings/:id`
- `POST /api/v1/meetings/:id/complete`
- `DELETE /api/v1/meetings/:id`
- `GET /api/v1/meetings/trash`
- `POST /api/v1/meetings/:id/restore`
- `DELETE /api/v1/meetings/:id/permanent`

### Prompt

- `GET /api/v1/prompts`
- `GET /api/v1/prompts/:id`
- `POST /api/v1/prompts`
- `PUT /api/v1/prompts/:id`
- `DELETE /api/v1/prompts/:id`

### Note

- `GET /api/v1/meetings/:meetingId/note`
- `PUT /api/v1/meetings/:meetingId/note`

### Result

- `GET /api/v1/meetings/:meetingId/result`
- `PATCH /api/v1/meetings/:meetingId/result`
- `POST /api/v1/meetings/:meetingId/result/regenerate`
- `GET /api/v1/meetings/:meetingId/result/export?format=pdf|docx|md`

### Transcription

- `GET /api/v1/meetings/:meetingId/transcripts`
- `POST /api/v1/meetings/:meetingId/transcripts/upload-url`
- `GET /api/v1/meetings/:meetingId/transcripts/jobs`
- `POST /api/v1/meetings/:meetingId/transcripts/jobs`
- WebSocket: `ws://host/ws/transcribe?meetingId=<uuid>`
  - client event: `audio` (ack 기반 backpressure 응답 포함)
  - server event: `transcript:partial`, `transcript:final`, `transcript:translation`, `transcript:fallback`, `transcript:error`

## Response Convention

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ErrorName",
    "statusCode": 400,
    "message": "message",
    "path": "/api/v1/...",
    "timestamp": "ISO-8601"
  }
}
```
