/**
 * 도메인 간 Meeting 상태 변경 알림을 위한 내부 이벤트.
 * TranscriptionResultCollector → MeetingStatusGateway 로 전달됩니다.
 */
export class MeetingStatusChangedEvent {
  static readonly EVENT_NAME = 'meeting.status.changed';

  constructor(
    public readonly meetingId: string,
    public readonly status: string,
  ) {}
}