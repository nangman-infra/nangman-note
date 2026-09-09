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
- 마크다운 에디터, 자동저장·수동 저장 (`Ctrl/⌘ S`)
- 입력 즉시 기기 초안 보존, 오프라인 복구·재연결 저장, 다중 탭 편집 충돌 감지
- 회의 종료 후 원본 노트 편집 및 Markdown 다운로드
- 장문 전 구간 분할 추출, 상세 항목 보존, 전체 개요·제목 재구성
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

## Note reliability

- 서버 저장은 `revision`을 기준으로 비교 후 갱신합니다. 다른 탭에서 먼저 수정했다면
  자동 덮어쓰기를 멈추고 서버 내용과 현재 초안을 확인·합칠 수 있습니다.
- 초안은 편집 세션별로 브라우저에 즉시 보관됩니다. 빈 내용으로 지운 수정도 복구하며,
  브라우저 저장이 차단되거나 용량이 부족하면 다운로드 안내를 표시합니다.
- 일시적 저장 오류는 최대 30초 간격으로 재시도하며, 네트워크 재연결 시 즉시 저장합니다.
  로그인·권한 오류나 편집 충돌은 해결 전까지 반복 저장하지 않습니다.
- 회의 종료와 AI 재생성은 최신 노트 저장 성공 후 진행합니다. 종료된 회의의 **원본 노트**
  탭에서도 원본을 편집할 수 있습니다. 노트 수정 후 AI 회의록에는 재생성으로 반영합니다.
- PostgreSQL 배포에는 `20260909100000-add-note-revision` 마이그레이션이 필요합니다.
  노트 저장 API는 이제 `expectedRevision`을 필수로 받으므로 프런트엔드와 백엔드를 함께 배포하세요.

## Configuration

품질 개선 내역, 공식 모범 사례, 장문 평가 및 검증 명령은 [QUALITY_REVIEW.md](./QUALITY_REVIEW.md)를 참고하세요.

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
