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

export const MEETING_LIST_POLL_INTERVAL_MS = 8000;
export const DEFAULT_MEETING_VISIBLE_LIMIT = 10;

export function isMeetingStatus(value: string): value is MeetingStatus {
  return (
    value === MeetingStatus.RECORDING ||
    value === MeetingStatus.PROCESSING ||
    value === MeetingStatus.COMPLETED
  );
}
