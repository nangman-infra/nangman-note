/**
 * RFC 6750 Bearer 토큰 파싱.
 *
 * - scheme 은 대소문자 무관 ("bearer", "Bearer")
 * - scheme 과 credentials 사이의 공백은 1개 이상 허용 (프록시가 공백을 정규화하지 않는 경우)
 * - credentials 는 공백 없는 단일 토큰이어야 함 (뒤에 붙은 잡문자는 거절)
 */
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export type BearerParseResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'missing' | 'malformed' };

export function parseBearerAuthorization(
  authorization: unknown,
): BearerParseResult {
  if (typeof authorization !== 'string' || authorization.trim().length === 0) {
    return { ok: false, reason: 'missing' };
  }

  const match = BEARER_PATTERN.exec(authorization.trim());
  if (!match) {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true, token: match[1] };
}

/** Authorization 헤더에서 Bearer 토큰만 뽑아낸다. 없거나 형식이 틀리면 undefined */
export function extractBearerToken(authorization: unknown): string | undefined {
  const result = parseBearerAuthorization(authorization);
  return result.ok ? result.token : undefined;
}
