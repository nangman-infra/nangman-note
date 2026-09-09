import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3217', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --port 3217',
    url: 'http://localhost:3217/api/health',
    timeout: 30_000,
    env: {
      NEXTAUTH_URL: 'http://localhost:3217',
      NEXTAUTH_SECRET: 'local-browser-test-secret',
      AUTHENTIK_ISSUER: 'http://localhost:3217/test-oidc',
      AUTHENTIK_CLIENT_ID: 'browser-test',
      AUTHENTIK_CLIENT_SECRET: 'browser-test',
    },
  },
});
