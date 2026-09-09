# Nangman Note

On-prem AI 회의 노트. 실시간 STT, AI 요약, 액션아이템 추출.
NestJS + Next.js + AWS Bedrock/Transcribe.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org/)

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
docker compose config
docker compose up -d --build --force-recreate backend frontend
docker compose logs -f
```

Backend는 IAM DB 인증과 함께 TLS 서버 인증서 검증을 강제합니다. Compose는 저장소의 AWS 공식
`deploy/rds/global-bundle.crt`를 컨테이너의 `/run/secrets/rds-ca-bundle.pem`에 읽기 전용으로
마운트하며, `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`,
`DB_SSL_CA_PATH=/run/secrets/rds-ca-bundle.pem`을 전달합니다. 검증을 끄지 마세요. CA bundle을
갱신할 때는 [AWS RDS 공식 trust store](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem)의
파일로 교체한 뒤 backend 이미지를 다시 생성하십시오.

OAuth 운영 배포에서는 루트 `.env`의 `NEXTAUTH_URL`을 브라우저가 접속하는 canonical HTTPS
origin 하나(예: `https://app.example.com`)로 반드시 지정합니다. Nginx Proxy Manager는
`Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`를 덮어써야 하며, www/non-www 같은 별칭은
앱에 도달하기 전에 `NEXTAUTH_URL` host로 redirect해야 합니다. Authentik Provider의 Redirect URI도
정확히 `{NEXTAUTH_URL}/api/auth/callback/authentik`이어야 합니다.

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
