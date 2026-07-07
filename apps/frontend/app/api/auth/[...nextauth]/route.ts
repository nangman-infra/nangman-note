import NextAuth from 'next-auth';
import { createAuthOptions } from '@/auth';

const buildHandler = () => NextAuth(createAuthOptions());

export async function GET(request: Request, context: unknown) {
  return buildHandler()(request, context);
}

export async function POST(request: Request, context: unknown) {
  return buildHandler()(request, context);
}
