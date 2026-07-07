FROM node:18-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter note-service build

FROM node:18-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/note-service/package.json ./apps/note-service/
COPY --from=builder /app/apps/note-service/dist ./apps/note-service/dist
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3001
CMD ["node", "apps/note-service/dist/main"]
