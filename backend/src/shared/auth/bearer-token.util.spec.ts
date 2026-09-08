import {
  extractBearerToken,
  parseBearerAuthorization,
} from './bearer-token.util';

describe('bearer-token.util', () => {
  it('parses a standard Bearer header', () => {
    expect(parseBearerAuthorization('Bearer abc.def.ghi')).toEqual({
      ok: true,
      token: 'abc.def.ghi',
    });
  });

  it('is case-insensitive for the scheme and tolerant of extra spaces', () => {
    expect(parseBearerAuthorization('bearer token')).toEqual({
      ok: true,
      token: 'token',
    });
    expect(parseBearerAuthorization('Bearer   token  ')).toEqual({
      ok: true,
      token: 'token',
    });
  });

  it('reports a missing header', () => {
    expect(parseBearerAuthorization(undefined)).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(parseBearerAuthorization('')).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(parseBearerAuthorization(['a', 'b'])).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('rejects malformed headers', () => {
    expect(parseBearerAuthorization('Bearer')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(parseBearerAuthorization('Basic dXNlcjpwYXNz')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(parseBearerAuthorization('Bearer token extra')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('extractBearerToken returns the token or undefined', () => {
    expect(extractBearerToken('Bearer t')).toBe('t');
    expect(extractBearerToken('nope')).toBeUndefined();
    expect(extractBearerToken(undefined)).toBeUndefined();
  });
});
