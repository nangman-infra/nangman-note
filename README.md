# Nangman Note

On-prem AI 회의 노트. 실시간 STT, AI 요약, 액션아이템 추출.
NestJS + Next.js + AWS Bedrock/Transcribe.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Features

- Amazon Transcribe Streaming 기반 한국어 실시간 전사 (WebSocket)
- Amazon Bedrock으로 요약 / 액션아이템 / 결정사항 추출
- 마크다운 에디터, 자동저장
- Markdown / PDF / DOCX export
- OIDC 인증 (Authentik 등)
- IAM Roles Anywhere — long-lived AWS 키 불필요
- RDS IAM 인증 — DB 비밀번호 없이 PostgreSQL 접속

## Stack

| Layer | Tech |
| --- | --- |
| Backend | NestJS 11, TypeORM 0.3, Socket.IO |
| Frontend | Next.js 16, React 19, TailwindCSS 4, NextAuth, Zustand |
| Storage | PostgreSQL (운영) / SQL.js (개발), S3 |
| AWS | Bedrock, Transcribe, Translate, Secrets Manager, RDS Signer |
| Runtime | Docker Compose (host network) |

## Requirements

- Node.js >= 22
- pnpm
- AWS 자격증명 (`AWS_PROFILE` 또는 IAM Roles Anywhere)
- 운영: PostgreSQL, S3 bucket, OIDC provider

## Quick start

```bash
# Backend
cd backend
cp .env.development.example .env.development
pnpm install
pnpm start:dev          # http://localhost:9999

# Frontend
cd frontend
cp .env.development.example .env.development.local
pnpm install
pnpm dev                # http://localhost:3000
```

개발 기본값은 `DB_ENGINE=sqljs` (파일 기반 SQLite)로 외부 DB 없이 동작합니다.

## Configuration

| Profile | Backend | Frontend |
| --- | --- | --- |
| Development | [`backend/.env.development.example`](./backend/.env.development.example) | [`frontend/.env.development.example`](./frontend/.env.development.example) |
| Production | [`backend/.env.production.example`](./backend/.env.production.example) | [`frontend/.env.production.example`](./frontend/.env.production.example) |

시크릿(DB 비밀번호, 암호화 키, OIDC client secret)은 코드/이미지에 박지 않고
`SECRET_*_ID` 변수로 이름만 전달하고 런타임에 AWS Secrets Manager에서 로딩합니다.

## Deployment

```bash
docker compose up -d
docker compose logs -f
```

IAM Roles Anywhere credential endpoint(`http://127.0.0.1:9912`) 접근을 위해
Linux 호스트와 `network_mode: host`가 필요합니다.

## Project structure

```
backend/src/
  domain/       meeting, transcription, note, result, prompt,
                user-settings, document-output
  shared/       auth, aws, config, crypto, events, filters,
                interceptors, logging

frontend/
  app/          Next.js App Router
  domains/      front-end 도메인 모듈
  components/   공용 UI
  lib/          api / ws 클라이언트, config, runtime-env
```

API 엔드포인트와 도메인 상세는 [`backend/README.md`](./backend/README.md) 참고.

## License

[MIT](./LICENSE)
