/**
 * 회의록 재생성 완료/실패를 알리는 내부 이벤트.
 * ResultService → MeetingStatusGateway 로 전달되어
 * WebSocket을 통해 프론트엔드에 브로드캐스트됩니다.
 */
export class ResultRegenerateEvent {
  static readonly EVENT_NAME = 'result.regenerate';

  constructor(
    public readonly meetingId: string,
    public readonly phase: 'started' | 'completed' | 'failed',
    public readonly ownerSub?: string,
    public readonly errorMessage?: string,
  ) {}
}
