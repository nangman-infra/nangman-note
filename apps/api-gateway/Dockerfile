FROM node:18-alpine AS builder
# Set working directory
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy the entire monorepo
COPY . .

# Install dependencies for the monorepo
RUN pnpm install --frozen-lockfile

# Build the specific app
RUN pnpm --filter api-gateway build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV production

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./

# Copy the app
COPY --from=builder /app/apps/api-gateway/package.json ./apps/api-gateway/
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "apps/api-gateway/dist/main"]
