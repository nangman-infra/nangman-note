import { MeetingTranscriptionMode } from './meeting.types';

export interface UserSettings {
  defaultPromptId: string;
  defaultTranscriptionMode: MeetingTranscriptionMode;
  defaultLanguageCode: string;
  defaultTranslateTargetLanguage: string;
  isConfigured: boolean;
}

export interface UpdateUserSettingsDto {
  defaultPromptId?: string;
  defaultTranscriptionMode?: MeetingTranscriptionMode;
  defaultLanguageCode?: string;
  defaultTranslateTargetLanguage?: string;
}
