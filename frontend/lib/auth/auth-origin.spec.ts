import { describe, expect, it } from 'vitest';
import { getExternalRequestOrigin, parseAuthPublicUrl } from './auth-origin';

describe('auth origin', () => {
  it('accepts one HTTPS public origin in production', () => {
    expect(
      parseAuthPublicUrl(' https://app.example.com ', 'production').origin,
    ).toBe('https://app.example.com');
  });

  it.each([
    '',
    'https://app.example.com,https://admin.example.com',
    'https://app.example.com/api/auth',
    'https://user:secret@app.example.com',
    'ftp://app.example.com',
  ])('rejects an invalid NEXTAUTH_URL: %s', (value) => {
    expect(() => parseAuthPublicUrl(value, 'production')).toThrow();
  });

  it('rejects plain HTTP in production but permits local development', () => {
    expect(() =>
      parseAuthPublicUrl('http://app.example.com', 'production'),
    ).toThrow(/https/);
    expect(
      parseAuthPublicUrl('http://localhost:3000', 'development').origin,
    ).toBe('http://localhost:3000');
  });

  it('uses the first forwarded host and protocol from the trusted proxy chain', () => {
    const headers = new Headers({
      host: '127.0.0.1:3002',
      'x-forwarded-host': 'app.example.com, 127.0.0.1:3002',
      'x-forwarded-proto': 'https, http',
    });

    expect(
      getExternalRequestOrigin({ url: 'http://127.0.0.1:3002/auth/signin', headers }),
    ).toBe('https://app.example.com');
  });
});
