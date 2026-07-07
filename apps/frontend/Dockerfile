FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
# ARM64 빌드용 필수 라이브러리 추가
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN npm i -g turbo
COPY . .
# frontend 프로젝트만 prune
RUN turbo prune frontend --docker

FROM --platform=$BUILDPLATFORM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN npm i -g pnpm
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN pnpm turbo run build --filter=frontend...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/frontend/public ./apps/frontend/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/frontend/server.js"]