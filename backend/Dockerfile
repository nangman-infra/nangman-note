# ─── Stage 1: Dependencies ───
FROM node:22-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ─── Stage 2: Build ───
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ─── Stage 3: Production ───
FROM node:22-bookworm-slim AS runner
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      dumb-init \
      fonts-noto-cjk && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# 비-root 사용자 생성
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nestjs

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Playwright와 호환되는 Chromium + 시스템 의존성 설치
# root 에서 설치 후 nestjs 유저에서도 접근 가능하도록 공유 경로 사용
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright-core install --with-deps chromium && \
    chmod -R 755 /app/.playwright-browsers

# 빌드 결과물 복사
COPY --from=build /app/dist ./dist

# data 디렉토리 (개발 sqlite용, prod에서는 불필요하지만 안전하게)
RUN mkdir -p /app/data && chown nestjs:nodejs /app/data

USER nestjs

EXPOSE 9999

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
