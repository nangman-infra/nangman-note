import {
  DEFAULT_AUDIO_INPUT_SOURCE,
  type AudioInputSource,
} from '../types/audio-input.types';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export type AudioCapturePermission = 'prompt' | 'granted' | 'denied' | 'unsupported';
export type AudioCaptureFailureReason =
  | 'denied'
  | 'unsupported'
  | 'device-not-found'
  | 'device-unavailable'
  | 'invalid-device'
  | 'unknown';

export interface AudioCaptureRequestResult {
  granted: boolean;
  reason?: AudioCaptureFailureReason;
}

export interface AudioCaptureRequest {
  deviceId?: string;
  inputSource?: AudioInputSource;
}

export function isMediaDevicesSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  const allDevices = await navigator.mediaDevices.enumerateDevices();
  return allDevices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `마이크 ${index + 1}`,
    }));
}

export function createAudioConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48_000 },
    sampleSize: { ideal: 16 },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
}

export function isSupportedAudioInputSource(inputSource: AudioInputSource): boolean {
  return inputSource === DEFAULT_AUDIO_INPUT_SOURCE;
}
