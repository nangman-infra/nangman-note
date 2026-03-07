import { env } from '@/lib/config/env';

// API URLs
export const API_URL = env.API_URL;

// App Configuration
export const APP_NAME = env.APP_NAME;
export const APP_VERSION = env.APP_VERSION;

// Feature Flags
export const ENABLE_OFFLINE = env.ENABLE_OFFLINE;
export const AUTO_SAVE_DELAY = env.AUTO_SAVE_DELAY;

// UI Constants
export const SIDEBAR_WIDTH = 240;
export const LIST_WIDTH = 320;
export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

// Meeting Constants
export const MAX_MEETING_DURATION = 4 * 60 * 60; // 4 hours in seconds
export const TRANSCRIPT_DELAY_MS = 500;

// Default Prompt IDs
export const DEFAULT_PROMPT_ID = 'prompt_default_meeting';
export const PROMPT_IDS = {
  MEETING: 'prompt_default_meeting',
  LECTURE: 'prompt_default_lecture',
  MENTORING: 'prompt_default_seminar', // DB 레거시 ID — 실제 documentType은 'mentoring'
} as const;

// Prompt Document Type Labels & Help Text
export type PromptDocumentType = 'meeting' | 'lecture' | 'mentoring';

export const PROMPT_DOCUMENT_TYPE_LABELS: Record<PromptDocumentType, string> = {
  meeting: '회의',
  lecture: '강의',
  mentoring: '멘토링',
};

export const PROMPT_DOCUMENT_TYPE_HELP_TEXT: Record<PromptDocumentType, string> = {
  meeting: '안건, 결정사항, 액션 아이템 중심으로 정리합니다.',
  lecture: '핵심 개념, 예시, 복습 포인트 중심으로 정리합니다.',
  mentoring: '실무 팁, 후속 과제, 추가 조사 키워드 중심으로 정리합니다.',
};
