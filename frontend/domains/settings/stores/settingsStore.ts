import { create } from 'zustand';
import { DEFAULT_PROMPT_ID } from '@/lib/constants';
import { settingsApi } from '../api/settingsApi';
import { MeetingTranscriptionMode } from '../../meeting/types/meeting.types';
import type { UpdateUserSettingsDto, UserSettings } from '../types/settings.types';

const LEGACY_MEETING_SETTINGS_KEY = 'transnote-meeting-settings';
const LEGACY_PROMPT_SETTINGS_KEY = 'transnote-prompt-settings';

function extractPersistedState<T>(storageKey: string): Partial<T> | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const candidate = parsed as { state?: Partial<T> } | Partial<T>;
    return 'state' in candidate && candidate.state
      ? candidate.state
      : (candidate as Partial<T>);
  } catch {
    return null;
  }
}

function readLegacyBrowserSettings(): UpdateUserSettingsDto | null {
  const legacyMeeting =
    extractPersistedState<{
      defaultTranscriptionMode: MeetingTranscriptionMode;
      defaultLanguageCode: string;
      defaultTranslateTargetLanguage: string;
    }>(LEGACY_MEETING_SETTINGS_KEY) ?? {};
  const legacyPrompt =
    extractPersistedState<{ selectedPromptId: string }>(
      LEGACY_PROMPT_SETTINGS_KEY,
    ) ?? {};

  const next: UpdateUserSettingsDto = {};

  if (
    legacyMeeting.defaultTranscriptionMode === MeetingTranscriptionMode.BATCH ||
    legacyMeeting.defaultTranscriptionMode === MeetingTranscriptionMode.REALTIME
  ) {
    next.defaultTranscriptionMode = legacyMeeting.defaultTranscriptionMode;
  }

  if (typeof legacyMeeting.defaultLanguageCode === 'string') {
    next.defaultLanguageCode = legacyMeeting.defaultLanguageCode;
  }

  if (typeof legacyMeeting.defaultTranslateTargetLanguage === 'string') {
    next.defaultTranslateTargetLanguage =
      legacyMeeting.defaultTranslateTargetLanguage;
  }

  if (typeof legacyPrompt.selectedPromptId === 'string') {
    next.defaultPromptId = legacyPrompt.selectedPromptId;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function clearLegacyBrowserSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_MEETING_SETTINGS_KEY);
  window.localStorage.removeItem(LEGACY_PROMPT_SETTINGS_KEY);
}

function applySettings(settings: UserSettings) {
  return {
    defaultPromptId: settings.defaultPromptId || DEFAULT_PROMPT_ID,
    defaultTranscriptionMode:
      settings.defaultTranscriptionMode ?? MeetingTranscriptionMode.REALTIME,
    defaultLanguageCode: settings.defaultLanguageCode ?? '',
    defaultTranslateTargetLanguage:
      settings.defaultTranslateTargetLanguage ?? '',
    isConfigured: settings.isConfigured,
  };
}

interface UserSettingsState {
  /** 기본 결과 프롬프트 */
  defaultPromptId: string;
  /** 기본 전사 모드 */
  defaultTranscriptionMode: MeetingTranscriptionMode;
  /** 기본 전사 언어 (빈 문자열 = 자동 감지) */
  defaultLanguageCode: string;
  /** 기본 번역 대상 언어 (빈 문자열 = 번역 안 함) */
  defaultTranslateTargetLanguage: string;
  /** 서버 설정 hydrate 여부 */
  isHydrated: boolean;
  /** 설정 로딩 여부 */
  isLoading: boolean;
  /** 설정 저장 여부 */
  isSaving: boolean;
  /** 최근 오류 */
  error: string | null;
  /** 서버에 실제 사용자 설정 row가 있는지 */
  isConfigured: boolean;

  fetchSettings: () => Promise<void>;
  updateSettings: (dto: UpdateUserSettingsDto) => Promise<boolean>;
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  defaultPromptId: DEFAULT_PROMPT_ID,
  defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
  defaultLanguageCode: '',
  defaultTranslateTargetLanguage: '',
  isHydrated: false,
  isLoading: false,
  isSaving: false,
  error: null,
  isConfigured: false,

  fetchSettings: async () => {
    if (get().isLoading) return;

    try {
      set({ isLoading: true, error: null });
      let settings = await settingsApi.get();

      if (!settings.isConfigured) {
        const legacySettings = readLegacyBrowserSettings();
        if (legacySettings) {
          try {
            settings = await settingsApi.update(legacySettings);
            clearLegacyBrowserSettings();
          } catch {
            // Legacy migration 실패는 현재 서버 기본값 사용으로 폴백한다.
          }
        }
      }

      set({
        ...applySettings(settings),
        isHydrated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isHydrated: true,
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch user settings',
      });
    }
  },

  updateSettings: async (dto) => {
    try {
      set({ isSaving: true, error: null });
      const settings = await settingsApi.update(dto);
      set({
        ...applySettings(settings),
        isHydrated: true,
        isSaving: false,
        error: null,
      });
      return true;
    } catch (error) {
      set({
        isSaving: false,
        error:
          error instanceof Error ? error.message : 'Failed to update user settings',
      });
      return false;
    }
  },
}));
