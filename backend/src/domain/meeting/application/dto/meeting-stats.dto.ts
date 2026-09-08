/** 대시보드 집계 — 목록 페이지 크기와 무관하게 사용자의 전체 회의를 기준으로 계산한다. */
export interface MeetingWeeklyBucketDto {
  /** YYYY-MM-DD (서버 로컬 날짜 기준) */
  date: string;
  count: number;
}

export interface MeetingStatsDto {
  totalMeetings: number;
  recordingMeetings: number;
  processingMeetings: number;
  completedMeetings: number;
  /** 종료된 회의의 (endedAt - startedAt) 합계, 초 단위 */
  totalTranscribedSeconds: number;
  /** 최근 7일, 오래된 날부터 오늘까지 7개 고정 */
  weekly: MeetingWeeklyBucketDto[];
}
