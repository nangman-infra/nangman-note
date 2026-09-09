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
- `DB_SSL_CA` (optional inline CA PEM; literal `\\n` is expanded)
- `DB_SSL_CA_PATH` (optional CA PEM file path; configure only one CA source)
- `DB_POOL_MAX` (default: `10`)
- `DB_CONNECTION_TIMEOUT_MS` (default: `5000`)
- `DB_IDLE_TIMEOUT_MS` (default: `30000`)
- `DB_STATEMENT_TIMEOUT_MS` (default: `15000`)
- `ENCRYPTION_KEYS` (recommended JSON keyring, e.g. `{"2026-09":"<64-hex>"}`)
- `ENCRYPTION_ACTIVE_KID` (key ID used for new ciphertext)
- `ENCRYPTION_KEY` (legacy single-key fallback; retain during migration if old ciphertext exists)
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
- `PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS` (`1` ~ `8`, optional override; when omitted the app computes a safe default from container CPU/memory)
- `LOG_LEVEL`
- `CORS_ORIGIN` (comma-separated)
- `TRUST_PROXY` (Express `trust proxy`; default `loopback` — trust `X-Forwarded-*` only from same-host reverse proxies such as NPM / the Next.js proxy)
- `AUTH_ENABLED` (must be `true` in production; `false` disables auth **and** tenant scoping — local development only)
- `AUTH_OIDC_ISSUER` (Authentik issuer URL, e.g. `https://auth.example.com/application/o/transnote/`; trailing-slash variants are both accepted)
- `AUTH_OIDC_AUDIENCE` (Authentik client ID)
- `AUTH_OIDC_JWKS_URI` (optional; when empty the `jwks_uri` from OIDC discovery is used. Discovery failures fail closed and are retried after a short cooldown — set explicitly in production, Authentik: `<issuer>jwks/`)
- `AUTH_OIDC_ALGORITHMS` (comma-separated allow-list of asymmetric JWS algorithms; default `RS256`)

Recommended mode:

- Development: `DB_ENGINE=sqljs` (file-based local DB)
- Production: `DB_ENGINE=postgres` (RDS/Aurora) + `DB_MIGRATIONS_RUN=true`

Operational BP (PostgreSQL):

- Keep `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=true` in production. Production and IAM DB auth fail startup if certificate verification is disabled.
- Mount the RDS trust bundle with `DB_SSL_CA_PATH`, or supply `DB_SSL_CA`; never configure both.
- Tune connection pool/timeouts via DB_* timeout variables before scaling app instances.

Encryption and migration policy:

- New ciphertext uses a versioned `kid` envelope and entity-field + stable meeting-row AAD. Keep retired keys in `ENCRYPTION_KEYS` until all data has been re-encrypted.
- Secrets Manager key rotation is **restart-required**: update the keyring, then perform a rolling restart. The process never replaces encryption keys through a `process.env` hot reload.
- TypeORM migration CLI SQL bypasses entity subscribers. Migrations must not `INSERT`/`UPDATE` encryptable columns (`note.content`, `meeting_result.content`, transcript text, or sensitive search projection fields). Rebuild through application services/subscribers instead; the migration policy test enforces this.

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

Note reads include `revision` (`0` for an unsaved, virtual note). Writes require
`{ "content": "Markdown", "expectedRevision": 0 }`, using the revision from the
last successful read/save. The server compares and increments the revision in an
atomic update; a stale edit returns `409 Conflict` without overwriting content.
Fetch the current note and let the user resolve the conflict before retrying.
Retrying content already stored is idempotent, including a lost save response.
Missing/invalid revisions and content over 100,000 characters return `400`.
Existing PostgreSQL installations must run `20260909100000-add-note-revision`
before deploying the updated note API and frontend together.

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
