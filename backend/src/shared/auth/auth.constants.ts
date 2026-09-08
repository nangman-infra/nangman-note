export const IS_PUBLIC_KEY = 'isPublic';
export const AUTH_USER_KEY = 'authUser';

/**
 * 토큰 만료(exp/nbf) 판정 시 허용하는 시계 오차(초).
 * HTTP(jose jwtVerify)와 WebSocket 만료 감시가 같은 값을 써야
 * "HTTP 는 아직 유효한데 WS 는 끊는" 불일치가 생기지 않는다.
 */
export const ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS = 5;
export const ACCESS_TOKEN_CLOCK_TOLERANCE_MS =
  ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS * 1000;
