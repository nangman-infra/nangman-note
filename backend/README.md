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

- `.env.example` (base)
- `.env.development.example`
- `.env.production.example`

Runtime load order:

1. `.env.${NODE_ENV}`
2. `.env`

Required/used variables:

- `PORT`
- `NODE_ENV` (`development` | `test` | `production`)
- `DB_PATH`
- `ENCRYPTION_KEY`
- `AWS_REGION`
- `AWS_PROFILE`
- `LOG_LEVEL`
- `CORS_ORIGIN` (comma-separated)

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

## API

### Meeting

- `POST /api/v1/meetings`
- `GET /api/v1/meetings`
- `GET /api/v1/meetings/search`
- `GET /api/v1/meetings/:id`
- `PATCH /api/v1/meetings/:id`
- `POST /api/v1/meetings/:id/complete`
- `DELETE /api/v1/meetings/:id`

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
- WebSocket: `ws://host/ws/transcribe?meetingId=<uuid>`
  - client event: `audio`
  - server event: `transcript`

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
