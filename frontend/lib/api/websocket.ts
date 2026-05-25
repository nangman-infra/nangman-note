import { io, Socket } from 'socket.io-client';
import { getRuntimeEnv } from '@/lib/config/runtime-env';

/**
 * WebSocket 연결을 생성하는 공통 팩토리.
 *
 * WS_URL은 런타임 환경변수(window.__RUNTIME_ENV__.WS_URL)에서 읽는다.
 * - 값이 있으면: 해당 URL로 직접 연결 (예: https://app.example.com)
 * - 빈 문자열이면: same-origin 연결 (io(undefined, ...))
 *
 * 개발 환경: WS_URL=http://localhost:9999 → 백엔드 직접 연결
 * 운영 환경: WS_URL=https://app.example.com → 리버스 프록시 /ws/ 경유
 *
 * @param path  socket.io path (예: '/ws/transcribe', '/ws/meeting-status')
 * @param query 쿼리 파라미터 (예: { meetingId })
 * @param authToken 정적 토큰 문자열 또는 최신 토큰을 반환하는 getter 함수.
 *   getter 함수를 전달하면 socket.io 재연결(reconnect) 시마다 호출되어
 *   항상 최신 access token 으로 handshake 합니다.
 */
export function createSocket(
  path: string,
  query?: Record<string, string>,
  authToken?: string | (() => string | undefined),
): Socket {
  const wsUrl = getRuntimeEnv('WS_URL');

  // auth 를 함수로 전달 → 재연결 시마다 최신 토큰 사용
  const resolveAuth = (): Record<string, string> | undefined => {
    const token =
      typeof authToken === 'function' ? authToken() : authToken;
    return token ? { token } : undefined;
  };

  const socket = io(wsUrl || undefined, {
    path,
    query,
    auth: (cb) => {
      cb(resolveAuth() ?? {});
    },
    // WebSocket 전용 transport — polling→upgrade 불안정 제거 (ARTS 동일)
    transports: ['websocket'],
    withCredentials: true,
    // 안정적인 재연결 설정
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 10000,
    forceNew: true,
  });

  return socket;
}
