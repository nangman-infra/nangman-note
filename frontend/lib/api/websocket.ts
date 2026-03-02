import { io, Socket } from 'socket.io-client';
import { env } from '@/lib/config/env';

/**
 * same-origin WebSocket 연결을 생성하는 공통 팩토리.
 *
 * Next.js rewrite 프록시를 통해 /ws/* → 백엔드로 라우팅되므로
 * 별도의 WS_URL 없이 현재 origin 에 연결합니다.
 *
 * @param path  socket.io path (예: '/ws/transcribe', '/ws/meeting-status')
 * @param query 쿼리 파라미터 (예: { meetingId })
 */
export function createSocket(
  path: string,
  query?: Record<string, string>,
): Socket {
  // 실시간 전사 경로는 websocket 강제:
  // polling 모드에서는 오디오 binary가 base64 프레이밍으로 전환되어
  // 지연/품질 저하를 유발할 수 있음.
  const forceWebSocket = path === '/ws/transcribe';
  const socket = io(env.WS_URL || undefined, {
    path,
    query,
    transports: forceWebSocket || env.WS_URL ? ['websocket'] : ['polling', 'websocket'],
    withCredentials: true,
  });

  return socket;
}
