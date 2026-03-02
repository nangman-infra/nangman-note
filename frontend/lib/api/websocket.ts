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
 * 운영 환경: WS_URL=https://app.example.com → NPM /ws/ 프록시 경유
 *
 * @param path  socket.io path (예: '/ws/transcribe', '/ws/meeting-status')
 * @param query 쿼리 파라미터 (예: { meetingId })
 */
export function createSocket(
  path: string,
  query?: Record<string, string>,
  authToken?: string,
): Socket {
  const wsUrl = getRuntimeEnv('WS_URL');

  const socket = io(wsUrl || undefined, {
    path,
    query,
    auth: authToken ? { token: authToken } : undefined,
    transports: ['polling', 'websocket'],
    withCredentials: true,
  });

  return socket;
}
