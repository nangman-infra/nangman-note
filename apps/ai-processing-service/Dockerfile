FROM node:18-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter ai-processing-service build

FROM node:18-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/ai-processing-service/package.json ./apps/ai-processing-service/
COPY --from=builder /app/apps/ai-processing-service/dist ./apps/ai-processing-service/dist
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3003
CMD ["node", "apps/ai-processing-service/dist/main"]
