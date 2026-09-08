// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsInlineView } from './SettingsInlineView';

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  pushToast: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('@/components/feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  useSession: () => ({ data: { user: { email: 'user@example.com' } } }),
}));

vi.mock('@/domains/prompt', () => ({
  formatPromptLabel: (prompt: { name: string }) => prompt.name,
  usePrompt: () => ({ isLoading: false }),
}));

vi.mock('@/domains/meeting', () => ({
  meetingApi: { exportAll: vi.fn() },
}));

vi.mock('@/domains/settings', () => ({
  useUserSettingsStore: () => ({
    defaultPromptId: 'prompt-default',
    defaultTranscriptionMode: 'realtime',
    defaultLanguageCode: 'ko-KR',
    defaultTranslateTargetLanguage: 'en',
    isHydrated: true,
    isLoading: false,
    isSaving: false,
    fetchSettings: mocks.fetchSettings,
    updateSettings: mocks.updateSettings,
  }),
}));

vi.mock('@/lib/notifications/notifications', () => ({
  isNotifyOnCompleteEnabled: () => false,
  setNotifyOnCompleteEnabled: vi.fn(),
}));

vi.mock('@/lib/theme/theme', () => ({
  getStoredTheme: () => 'light',
  setTheme: vi.fn(),
}));

describe('SettingsInlineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSettings.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('sends an empty string when translation is disabled', async () => {
    render(
      <SettingsInlineView
        prompts={[
          {
            id: 'prompt-default',
            name: '기본 회의록',
            content: 'prompt',
            documentType: 'meeting',
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText('번역 대상 언어'), {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(mocks.updateSettings).toHaveBeenCalledWith({
        defaultTranslateTargetLanguage: '',
      });
    });
  });
});
