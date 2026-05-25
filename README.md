# Nangman Note

> On-prem AI 회의 노트 — 실시간 STT, AI 요약, 액션아이템 추출
> NestJS + Next.js, AWS Bedrock/Transcribe 기반의 자체 호스팅 SaaS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org/)

---

## 한눈에 보기

회의 음성을 실시간으로 받아 **한국어 STT(Amazon Transcribe)** 로 전사하고,
LLM(**Amazon Bedrock**)으로 요약·액션아이템을 추출하며,
회의 종료 후 Markdown / PDF / DOCX로 export할 수 있는 **온프렘 SaaS**입니다.

데이터·시크릿은 모두 사용자의 AWS 계정 안에서만 흐릅니다.

## 핵심 기능

- 🎙️ **실시간 전사** — WebSocket으로 오디오 청크를 받아 Amazon Transcribe Streaming으로 즉시 전사
- 🧠 **AI 요약 & 액션아이템** — Bedrock(예: Nova/Claude)로 회의 요약 / 안건 / 결정사항 / 액션아이템 자동 추출
- 📝 **노트 에디터** — Toast UI 기반 마크다운 에디터, 자동저장 (`NEXT_PUBLIC_AUTO_SAVE_DELAY`)
- 📤 **Export** — `GET /api/v1/meetings/:id/result/export?format=pdf|docx|md`
- 🔐 **OIDC 인증** — Authentik 등 표준 OIDC IdP 연동, 백엔드는 JWKS 검증
- ☁️ **IAM Roles Anywhere** — 온프렘에서도 long-lived 키 없이 AWS 임시 자격증명 사용
- 🗄️ **RDS IAM 인증** — DB 비밀번호 불필요, IAM 토큰으로 PostgreSQL 접속

## 아키텍처 (개요)

```
┌─────────────┐    OIDC      ┌─────────────────┐
│  Browser    │ ───────────► │  Authentik      │
│  (Next.js)  │              └─────────────────┘
│             │
│  WebSocket  │
└──────┬──────┘
       │  /ws/transcribe (audio chunks)
       ▼
┌──────────────────┐     ┌────────────────────┐
│  Next.js Server  │ ──► │  NestJS Backend    │
│  (proxy + auth)  │     │  - Socket.IO       │
└──────────────────┘     │  - REST  /api/v1/* │
                         │  - JWKS 검증       │
                         └────┬───────┬───────┘
                              │       │
                              │       └─► Amazon Transcribe Streaming
                              │           Amazon Bedrock (요약)
                              │           Amazon Translate (선택)
                              │
                              └─► PostgreSQL (RDS, IAM auth)
                                  S3 (오디오 / export 결과)
                                  Secrets Manager (런타임 시크릿 로딩)
```

## 기술 스택

**Backend** — NestJS 11, TypeORM 0.3, PostgreSQL / SQL.js, Socket.IO, Winston, Helmet, Playwright(PDF)
**Frontend** — Next.js 16, React 19, TailwindCSS 4, Zustand, Auth.js (NextAuth), Toast UI Editor, Vitest, Playwright
**AWS** — Bedrock, Transcribe (Streaming + Batch), S3, Translate, Secrets Manager, RDS Signer (IAM Auth)
**Auth** — Authentik (OIDC), JWKS
**Infra** — Docker Compose (host network), IAM Roles Anywhere via credential endpoint

## 도메인 구조

```
backend/src/domain/
├── meeting/            # 회의 생성, 조회, 휴지통, 영구삭제
├── transcription/      # 실시간 전사 게이트웨이, 업로드/잡 관리
├── note/               # 회의 노트
├── result/             # AI 요약 결과, regenerate, export
├── prompt/             # 요약 프롬프트 템플릿 CRUD
├── user-settings/      # 사용자 설정
└── document-output/    # PDF/DOCX 렌더링

frontend/
├── app/                # Next.js App Router (auth, meeting, settings, ...)
├── domains/            # 프론트 도메인 모듈 (meeting, prompt, note, ...)
├── components/         # 공용 UI 컴포넌트
└── lib/                # API/WS 클라이언트, config, runtime-env
```

## 빠른 시작 (개발 환경)

요구사항: **Node 22+**, **pnpm**, AWS 자격증명(`aws sso login` 또는 `~/.aws/credentials`)

```bash
# 1. 의존성 설치
cd backend  && pnpm install
cd ../frontend && pnpm install

# 2. 환경 파일 복사
cp backend/.env.development.example  backend/.env.development
cp frontend/.env.development.example frontend/.env.development.local
# → 필요한 값(AWS_PROFILE, AUTHENTIK_*) 채우기

# 3. 실행
cd backend  && pnpm start:dev      # http://localhost:9999
cd frontend && pnpm dev            # http://localhost:3000
```

기본 개발 모드는 `DB_ENGINE=sqljs`(파일 기반 SQLite)로 외부 DB 없이 동작합니다.

## 환경변수

대표 변수만 정리. 전체 목록은 [`backend/README.md`](./backend/README.md), [`frontend/README.md`](./frontend/README.md), 그리고 각 `.env.*.example` 파일을 참고하세요.

| 변수 | 설명 | 예시 |
|---|---|---|
| `DB_ENGINE` | `sqljs` (개발) 또는 `postgres` (운영) | `postgres` |
| `DB_IAM_AUTH` | RDS IAM 인증 사용 여부 | `true` |
| `AWS_REGION` | AWS 리전 | `ap-northeast-2` |
| `AWS_TRANSCRIBE_LANGUAGE_CODE` | Transcribe 언어 | `ko-KR` |
| `AWS_BEDROCK_MODEL_ID` | Bedrock 모델 ID | `apac.amazon.nova-pro-v1:0` |
| `SECRET_ENCRYPTION_KEY_ID` | Secrets Manager 시크릿 이름 | `nangman-note/encryption-key` |
| `AUTH_ENABLED` | 백엔드 OIDC 검증 활성화 | `true` |
| `AUTH_OIDC_ISSUER` | Authentik issuer URL | `https://auth.example.com/application/o/<slug>/` |
| `NEXT_PUBLIC_ANALYTICS_SCRIPT_URL` | (선택) 자체 호스팅 analytics 스크립트 URL | (비어두면 미사용) |

> 시크릿(비밀번호, 암호화 키, OIDC client secret)은 **코드/이미지에 박지 않고** 런타임에 AWS Secrets Manager에서 로딩합니다.

## 운영 배포 (Docker Compose, 온프렘)

```bash
# .env 작성 (DB_HOST, AWS_S3_AUDIO_BUCKET, AUTHENTIK_*, CORS_ORIGIN 등)
docker compose up -d
docker compose logs -f
```

`network_mode: host`로 동작합니다. IAM Roles Anywhere credential endpoint
(`http://127.0.0.1:9912`)에 접근하기 위해 Linux 호스트가 필요합니다.

상세 배포 가이드는 추후 `docs/` 하위에 추가 예정.

## 보안

- **시크릿 스캐닝** 및 **push protection** 활성화 (GitHub)
- `main` 브랜치는 PR 필수 / linear history 강제 / force-push·삭제 차단
- 컨테이너 안에는 시크릿 평문이 존재하지 않음 (Secrets Manager 런타임 로딩)
- 백엔드는 Helmet, CORS allowlist, JWKS 검증, RDS SSL 강제
- 취약점 제보는 GitHub Security Advisory로 보고해 주세요

## 기여

PR / 이슈 환영합니다. main에 직접 push는 불가하며 PR을 통해서만 머지됩니다.
머지 정책은 **squash only** + **branch auto-delete**입니다.

## 라이선스

[MIT](./LICENSE) © 2026 Nangman Infra
