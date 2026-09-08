This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

This project validates frontend environment variables at runtime via `lib/config/env.ts` (Zod schema).
Environment profiles are managed separately for development and production.

```bash
# Development
cp .env.development.example .env.development.local

# Production
cp .env.production.example .env.production.local
```

Required keys for both profiles:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_ENABLE_OFFLINE` (`true` or `false`)
- `NEXT_PUBLIC_AUTO_SAVE_DELAY` (number: 500~10000)

Optional keys:

- `NEXT_PUBLIC_API_URL` (default: empty string = same-origin `/api/*` proxy)
- `WS_URL` (server runtime, injected to the browser; default: empty string = same-origin `/ws/*`)
- `BACKEND_URL` (server runtime proxy target, default: `http://localhost:9999`)

Auth (NextAuth v4 + Authentik):

- `NEXTAUTH_URL` — single public origin of the app (used for the OAuth redirect URI and cookie flags)
- `NEXTAUTH_SECRET` — session cookie (JWE) key. In production it is loaded once at boot from Secrets Manager (`SECRET_AUTH_ID`); rotating it requires a restart, otherwise every logged-in session would be invalidated instantly
- `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`

Request/auth flow (see `proxy.ts`, `lib/api/client.ts`, `components/auth/AuthSessionProvider.tsx`):

- `/api/*` and `/ws/*` are proxied to `BACKEND_URL` only when the NextAuth session cookie carries an access token; otherwise the proxy answers `401` itself so anonymous/expired sessions never reach the backend.
- `apiClient` never sends a request without a Bearer token. A missing token triggers a single re-authentication (sign-in redirect) instead of a stream of 401s.
- Access tokens are refreshed server-side in the `jwt` callback (90s before expiry). A permanent refresh failure (`invalid_grant`) clears the tokens and the client re-logs in via Authentik SSO; transient IdP failures keep the current tokens and retry later.

Validation policy:

- Development (`NODE_ENV=development`): API/WS URL can be omitted to use same-origin proxy.
- Production (`NODE_ENV=production`): API/WS URL can be omitted if frontend proxy(`BACKEND_URL`) is configured.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
