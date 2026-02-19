// API URLs
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

// App Configuration
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'TransNote';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

// Feature Flags
export const ENABLE_OFFLINE = process.env.NEXT_PUBLIC_ENABLE_OFFLINE === 'true';
export const AUTO_SAVE_DELAY = Number(process.env.NEXT_PUBLIC_AUTO_SAVE_DELAY) || 3000;

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
