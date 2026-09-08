export interface AudioAckResponse {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
  fallbackToBatch?: boolean;
  mode?: 'batch';
}

// ── Backpressure & fallback 임계값 ──
// 200ms 청크 기준:
// - 단일 in-flight ACK로 오디오 순서를 보장하고 backlog 지속 시간으로 포화 감지
// - ACK_TIMEOUT 3초 → 개별 청크 응답 대기 (네트워크 지터 허용)
// - CONSECUTIVE_TIMEOUTS 15회 → 45초간 무응답 시 fallback
// - CONSECUTIVE_BACKPRESSURE 30회 → 서버 retryAfterMs(기본 200ms) 기준 약 6초 후 fallback
// - SATURATION 10초 → ACK 대기 중 backlog가 10초 유지되면 fallback
export const AUDIO_STREAMING_LIMITS = {
  ACK_TIMEOUT_MS: 3000,
  MAX_CONSECUTIVE_TIMEOUTS: 15,
  MAX_CONSECUTIVE_BACKPRESSURE: 30,
  MAX_SATURATION_MS: 10_000,
} as const;

export function shouldFallbackForSaturation(
  saturationStartedAt: number | null,
  now: number,
) {
  return (
    saturationStartedAt !== null &&
    now - saturationStartedAt >= AUDIO_STREAMING_LIMITS.MAX_SATURATION_MS
  );
}

export function isCapacityFallbackAck(response: AudioAckResponse) {
  return (
    response.reason === 'realtime-capacity-exceeded' &&
    response.fallbackToBatch &&
    response.mode === 'batch'
  );
}

export function getAckErrorMessage(
  response: AudioAckResponse,
  consecutiveBackpressureCount: number,
) {
  if (response.reason === 'backpressure') {
    if (
      consecutiveBackpressureCount >=
      AUDIO_STREAMING_LIMITS.MAX_CONSECUTIVE_BACKPRESSURE
    ) {
      return {
        kind: 'fallback' as const,
        reason: 'client-backpressure',
        message:
          '전사 서버 부하가 지속되어 실시간 전사를 중지했습니다. 회의를 종료하면 배치 전사로 처리됩니다.',
      };
    }

    return {
      kind: 'warning' as const,
      message: '전사 서버 처리 지연이 감지되었습니다. 네트워크 상태를 확인해주세요.',
    };
  }

  if (response.reason === 'session-warming') {
    return {
      kind: 'warning' as const,
      message: '실시간 전사 세션 준비 중입니다. 잠시만 기다려주세요.',
    };
  }

  if (response.reason === 'chunk-too-large') {
    return {
      kind: 'warning' as const,
      message: '오디오 청크가 커서 일부 구간 전송에 실패했습니다.',
    };
  }

  return {
    kind: 'warning' as const,
    message:
      '실시간 전사 연결이 불안정합니다. 잠시 후 자동으로 복구되지 않으면 회의를 다시 시작해주세요.',
  };
}
