export type AudioInputSource =
  | 'microphone'
  | 'meeting-audio-mix'
  | 'desktop-app'
  | 'mobile-app';

export const DEFAULT_AUDIO_INPUT_SOURCE: AudioInputSource = 'microphone';
