import { MeetingStatus } from '../types/meeting.types';

export type MeetingFilterKey = 'all' | MeetingStatus;
export type MeetingSortKey = 'newest' | 'oldest' | 'longest';

export const MEETING_LIST_FILTERS: Array<{
  key: MeetingFilterKey;
  label: string;
}> = [
  { key: 'all', label: '전체' },
  { key: MeetingStatus.RECORDING, label: '진행 중' },
  { key: MeetingStatus.PROCESSING, label: '정리 중' },
  { key: MeetingStatus.COMPLETED, label: '완료' },
];

/** 실시간 상태 소켓이 끊긴 상태의 폴링 주기 (폴링이 유일한 갱신 수단) */
export const MEETING_LIST_POLL_INTERVAL_MS = 8000;
/** 실시간 상태 소켓이 연결된 상태의 폴링 주기 (소켓이 놓친 변화를 보정하는 안전망) */
export const MEETING_LIST_POLL_INTERVAL_CONNECTED_MS = 30000;
export const DEFAULT_MEETING_VISIBLE_LIMIT = 10;

export function isMeetingStatus(value: string): value is MeetingStatus {
  return (
    value === MeetingStatus.RECORDING ||
    value === MeetingStatus.PROCESSING ||
    value === MeetingStatus.COMPLETED
  );
}
