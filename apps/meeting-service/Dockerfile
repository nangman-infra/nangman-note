FROM node:18-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter meeting-service build

FROM node:18-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/meeting-service/package.json ./apps/meeting-service/
COPY --from=builder /app/apps/meeting-service/dist ./apps/meeting-service/dist
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3002
CMD ["node", "apps/meeting-service/dist/main"]
