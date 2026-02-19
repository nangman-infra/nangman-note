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

- `NEXT_PUBLIC_API_URL` (http/https URL)
- `NEXT_PUBLIC_WS_URL` (ws/wss URL)
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_ENABLE_OFFLINE` (`true` or `false`)
- `NEXT_PUBLIC_AUTO_SAVE_DELAY` (number: 500~10000)

Validation policy:

- Development (`NODE_ENV=development`): API/WS URL have localhost defaults.
- Production (`NODE_ENV=production`): API/WS URL use production defaults and print warning if not explicitly set.

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
