# ─── Stage 1: Dependencies ───
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ─── Stage 2: Build ───
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ─── Stage 3: Font ───
# Pretendard TTF (한글 오픈소스, TrueType 아웃라인 → pdf-lib 호환)
FROM node:22-alpine AS font
RUN apk add --no-cache wget unzip && \
    mkdir -p /fonts && \
    wget -q -O /tmp/pretendard.zip \
      "https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip" && \
    unzip -o /tmp/pretendard.zip -d /tmp/pretendard && \
    find /tmp/pretendard -name "Pretendard-Regular.ttf" -exec cp {} /fonts/KoreanFont.ttf \; && \
    ls -la /fonts/ && \
    rm -rf /tmp/pretendard /tmp/pretendard.zip

# ─── Stage 4: Production ───
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# 비-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# 빌드 결과물 복사
COPY --from=build /app/dist ./dist

# 한글 PDF 폰트 (font stage에서 가져옴)
RUN mkdir -p /app/assets/fonts
COPY --from=font /fonts/KoreanFont.ttf /app/assets/fonts/KoreanFont.ttf

# data 디렉토리 (개발 sqlite용, prod에서는 불필요하지만 안전하게)
RUN mkdir -p /app/data && chown nestjs:nodejs /app/data

USER nestjs

EXPOSE 9999

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]