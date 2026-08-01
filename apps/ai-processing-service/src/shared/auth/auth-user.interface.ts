import type { JWTPayload } from 'jose';

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  scope: string[];
  raw: JWTPayload;
}
