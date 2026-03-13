// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsApi } from '../api/settingsApi';
import { useMeetingSettingsStore } from './settingsStore';
import { MeetingTranscriptionMode } from '../types/meeting.types';

vi.mock('../api/settingsApi', () => ({
  settingsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedSettingsApi = vi.mocked(settingsApi);

function resetStore() {
  useMeetingSettingsStore.setState({
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

describe('useMeetingSettingsStore', () => {
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

    await useMeetingSettingsStore.getState().fetchSettings();

    expect(useMeetingSettingsStore.getState()).toMatchObject({
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

    await useMeetingSettingsStore.getState().fetchSettings();

    expect(mockedSettingsApi.update).toHaveBeenCalledWith({
      defaultPromptId: 'prompt_user_legacy',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'ja-JP',
      defaultTranslateTargetLanguage: 'ko',
    });
    expect(localStorage.getItem('transnote-meeting-settings')).toBeNull();
    expect(localStorage.getItem('transnote-prompt-settings')).toBeNull();
    expect(useMeetingSettingsStore.getState()).toMatchObject({
      defaultPromptId: 'prompt_user_legacy',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'ja-JP',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
    });
  });
});
