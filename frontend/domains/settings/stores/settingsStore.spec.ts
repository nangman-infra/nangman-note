import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsApi } from '../api/settingsApi';
import { useUserSettingsStore } from './settingsStore';
import { MeetingTranscriptionMode } from '@/lib/transcription/transcriptionMode';

// localStorage + window polyfill for node test environment
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, value); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (index: number) => [...storageMap.keys()][index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// window must exist for extractPersistedState (typeof window !== 'undefined' guard)
if (typeof globalThis.window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { localStorage: localStorageMock };
} else {
  Object.defineProperty(globalThis.window, 'localStorage', { value: localStorageMock, writable: true });
}

vi.mock('../api/settingsApi', () => ({
  settingsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedSettingsApi = vi.mocked(settingsApi);

function resetStore() {
  useUserSettingsStore.setState({
    defaultPromptId: 'prompt_default_meeting',
    defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
    defaultLanguageCode: '',
    defaultTranslateTargetLanguage: '',
    isHydrated: false,
    isLoading: false,
    isSaving: false,
    error: null,
    isConfigured: false,
  });
}

describe('useUserSettingsStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetStore();
    localStorage.clear();
  });

  it('hydrates configured server settings into the store', async () => {
    mockedSettingsApi.get.mockResolvedValue({
      defaultPromptId: 'prompt_user_a',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'en-US',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
    });

    await useUserSettingsStore.getState().fetchSettings();

    expect(useUserSettingsStore.getState()).toMatchObject({
      defaultPromptId: 'prompt_user_a',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'en-US',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
      isHydrated: true,
      error: null,
    });
  });

  it('migrates legacy browser-local settings when the server has no stored row yet', async () => {
    localStorage.setItem(
      'transnote-meeting-settings',
      JSON.stringify({
        state: {
          defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
          defaultLanguageCode: 'ja-JP',
          defaultTranslateTargetLanguage: 'ko',
        },
        version: 0,
      }),
    );
    localStorage.setItem(
      'transnote-prompt-settings',
      JSON.stringify({
        state: {
          selectedPromptId: 'prompt_user_legacy',
        },
        version: 0,
      }),
    );

    mockedSettingsApi.get.mockResolvedValue({
      defaultPromptId: 'prompt_default_meeting',
      defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode: '',
      defaultTranslateTargetLanguage: '',
      isConfigured: false,
    });
    mockedSettingsApi.update.mockResolvedValue({
      defaultPromptId: 'prompt_user_legacy',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'ja-JP',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
    });

    await useUserSettingsStore.getState().fetchSettings();

    expect(mockedSettingsApi.update).toHaveBeenCalledWith({
      defaultPromptId: 'prompt_user_legacy',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'ja-JP',
      defaultTranslateTargetLanguage: 'ko',
    });
    expect(localStorage.getItem('transnote-meeting-settings')).toBeNull();
    expect(localStorage.getItem('transnote-prompt-settings')).toBeNull();
    expect(useUserSettingsStore.getState()).toMatchObject({
      defaultPromptId: 'prompt_user_legacy',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'ja-JP',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
    });
  });
});
