import { isAllowedCorsOrigin, parseAllowedOrigins } from './cors-origin.util';

describe('cors-origin.util', () => {
  it('parses comma-separated origins', () => {
    expect(
      parseAllowedOrigins(
        'http://localhost:3000, https://app.example.com , ,http://127.0.0.1:3000',
      ),
    ).toEqual([
      'http://localhost:3000',
      'https://app.example.com',
      'http://127.0.0.1:3000',
    ]);
  });

  it('allows localhost in non-production even when not explicitly listed', () => {
    const allowed = isAllowedCorsOrigin({
      origin: 'http://localhost:5555',
      allowedOrigins: ['https://app.example.com'],
      nodeEnv: 'development',
    });

    expect(allowed).toBe(true);
  });

  it('blocks unknown origin in production', () => {
    const allowed = isAllowedCorsOrigin({
      origin: 'http://localhost:5555',
      allowedOrigins: ['https://app.example.com'],
      nodeEnv: 'production',
    });

    expect(allowed).toBe(false);
  });

  it('can block missing origin when allowWithoutOrigin=false', () => {
    const allowed = isAllowedCorsOrigin({
      origin: undefined,
      allowedOrigins: ['https://app.example.com'],
      nodeEnv: 'production',
      allowWithoutOrigin: false,
    });

    expect(allowed).toBe(false);
  });
});
