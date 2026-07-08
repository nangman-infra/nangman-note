# ==========================================
# Turborepo 최적화 멀티스테이지 Dockerfile
# 사용법: docker build -t api-gateway --build-arg APP_NAME=api-gateway .
# ==========================================

# 1. Prune Stage: 필요한 소스코드만 쏙 골라내기 (가지치기)
FROM node:22-alpine AS builder
# ARM64(Pi 5) 빌드 에러 방지를 위한 필수 라이브러리 추가
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN npm i -g turbo
COPY . .
ARG APP_NAME
# 🌟 핵심 정답: 선택한 앱(예: api-gateway)과 관련된 의존성만 추려냅니다!
RUN turbo prune ${APP_NAME} --docker

# 2. Installer Stage: 의존성 설치
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN npm i -g pnpm
COPY .gitignore .gitignore
# 1단계에서 걸러진 가벼운 package.json 껍데기들만 복사
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

# 3. Builder Stage: 소스코드 빌드
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
ARG APP_NAME
RUN pnpm turbo run build --filter=${APP_NAME}...

# 4. Runner Stage: 실행 환경 (극도로 가벼움)
FROM node:22-alpine AS runner
WORKDIR /app
ARG APP_NAME
ENV NODE_ENV=production

# 빌드된 최종 산출물(dist)과 의존성 모듈만 복사 (모노레포 경로 구조 유지)
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/${APP_NAME}/package.json ./apps/${APP_NAME}/package.json
COPY --from=installer /app/apps/${APP_NAME}/dist ./apps/${APP_NAME}/dist
COPY --from=installer /app/apps/${APP_NAME}/node_modules ./apps/${APP_NAME}/node_modules
COPY --from=installer /app/packages/proto ./packages/proto

# 컨테이너 시작 시 실행할 명령어 (경로 유지)
CMD [ "sh", "-c", "node apps/${APP_NAME}/dist/main.js" ]
