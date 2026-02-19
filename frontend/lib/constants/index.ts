import { env } from '@/lib/config/env';

// API URLs
export const API_URL = env.API_URL;
export const WS_URL = env.WS_URL;

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
  SEMINAR: 'prompt_default_seminar',
} as const;
