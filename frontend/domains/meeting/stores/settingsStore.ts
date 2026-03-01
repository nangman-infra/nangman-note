import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MeetingTranscriptionMode } from '../types/meeting.types';

interface MeetingSettingsState {
  /** 기본 전사 모드 */
  defaultTranscriptionMode: MeetingTranscriptionMode;
  /** 기본 전사 언어 (빈 문자열 = 자동 감지) */
  defaultLanguageCode: string;
  /** 기본 번역 대상 언어 (빈 문자열 = 번역 안 함) */
  defaultTranslateTargetLanguage: string;

  setDefaultTranscriptionMode: (mode: MeetingTranscriptionMode) => void;
  setDefaultLanguageCode: (code: string) => void;
  setDefaultTranslateTargetLanguage: (lang: string) => void;
}

export const useMeetingSettingsStore = create<MeetingSettingsState>()(
  persist(
    (set) => ({
      defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode: '',
      defaultTranslateTargetLanguage: '',

      setDefaultTranscriptionMode: (mode) =>
        set({ defaultTranscriptionMode: mode }),
      setDefaultLanguageCode: (code) =>
        set({ defaultLanguageCode: code }),
      setDefaultTranslateTargetLanguage: (lang) =>
        set({ defaultTranslateTargetLanguage: lang }),
    }),
    {
      name: 'transnote-meeting-settings',
    },
  ),
);