'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface UseAudioCaptureReturn {
  permission: AudioCapturePermission;
  error: string | null;
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  requestPermission: (
    request?: AudioCaptureRequest | string,
  ) => Promise<AudioCaptureRequestResult>;
  selectDevice: (deviceId: string) => void;
  stopCapture: () => void;
}

function isMediaDevicesSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  const allDevices = await navigator.mediaDevices.enumerateDevices();
  return allDevices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `마이크 ${index + 1}`,
    }));
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [permission, setPermission] = useState<AudioCapturePermission>(() =>
    isMediaDevicesSupported() ? 'prompt' : 'unsupported',
  );
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const stopCapture = useCallback(() => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const requestPermission = useCallback(
    async (
      request?: AudioCaptureRequest | string,
    ): Promise<AudioCaptureRequestResult> => {
      if (!isMediaDevicesSupported()) {
        setPermission('unsupported');
        setError('현재 브라우저는 마이크 캡처를 지원하지 않습니다.');
        return { granted: false, reason: 'unsupported' };
      }

      // 이전 스트림이 남아있으면 정리
      stopCapture();
      const normalizedRequest =
        typeof request === 'string' ? { deviceId: request } : request;
      const effectiveDeviceId =
        normalizedRequest?.deviceId ?? selectedDeviceId;
      const inputSource =
        normalizedRequest?.inputSource ?? DEFAULT_AUDIO_INPUT_SOURCE;
      setError(null);

      const audioConstraints: MediaTrackConstraints = {
        // 현재는 마이크 수집만 지원하지만, 요청 모델은 이후 meeting audio mix / desktop app 확장을 대비한다.
        ...(effectiveDeviceId ? { deviceId: { exact: effectiveDeviceId } } : {}),
        // 회의 양측 음성을 함께 수집하기 위해 브라우저 DSP(특히 echo cancellation)를 비활성화한다.
        // 노트북 스피커로 재생되는 상대방 음성은 echo cancellation이 켜져 있으면 제거될 수 있다.
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };

      if (inputSource !== DEFAULT_AUDIO_INPUT_SOURCE) {
        setError(
          '선택한 입력 소스는 아직 준비 중입니다. 현재는 마이크 입력만 지원합니다.',
        );
        return { granted: false, reason: 'unsupported' };
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setPermission('granted');
        setError(null);

        // 권한 획득 후 디바이스 목록 갱신 (label이 채워짐)
        const audioDevices = await enumerateAudioDevices();
        setDevices(audioDevices);

        // 선택된 디바이스가 없으면 현재 스트림의 디바이스를 기본 선택
        if (!selectedDeviceId && audioDevices.length > 0) {
          const activeTrack = mediaStream.getAudioTracks()[0];
          const activeDeviceId = activeTrack?.getSettings()?.deviceId;
          if (activeDeviceId) {
            setSelectedDeviceId(activeDeviceId);
          }
        } else if (effectiveDeviceId) {
          setSelectedDeviceId(effectiveDeviceId);
        }

        return { granted: true };
      } catch (error) {
        if (error instanceof DOMException) {
          if (
            error.name === 'NotAllowedError' ||
            error.name === 'PermissionDeniedError'
          ) {
            setPermission('denied');
            setError('브라우저에서 마이크 접근이 차단되었습니다.');
            return { granted: false, reason: 'denied' };
          }

          if (
            error.name === 'NotFoundError' ||
            error.name === 'DevicesNotFoundError'
          ) {
            setPermission('prompt');
            setError('사용 가능한 마이크를 찾을 수 없습니다. 마이크 연결 상태를 확인해주세요.');
            return { granted: false, reason: 'device-not-found' };
          }

          if (error.name === 'OverconstrainedError') {
            setPermission('prompt');
            setError('선택한 마이크를 사용할 수 없습니다. 다른 입력 장치를 선택해주세요.');
            return { granted: false, reason: 'invalid-device' };
          }

          if (error.name === 'NotReadableError' || error.name === 'AbortError') {
            setPermission('prompt');
            setError('마이크를 사용할 수 없습니다. 다른 앱에서 사용 중인지 확인해주세요.');
            return { granted: false, reason: 'device-unavailable' };
          }
        }

        setPermission('prompt');
        setError('마이크를 초기화하지 못했습니다. 잠시 후 다시 시도해주세요.');
        return { granted: false, reason: 'unknown' };
      }
    },
    [selectedDeviceId, stopCapture],
  );

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      // 이미 스트림이 활성화 상태면 새 디바이스로 재연결
      if (streamRef.current) {
        stopCapture();
        // 다음 틱에서 requestPermission이 selectedDeviceId 반영 후 호출되도록
        // 호출자가 selectDevice 후 requestPermission을 다시 호출해야 함
      }
    },
    [stopCapture],
  );

  // 컴포넌트 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    permission,
    error,
    devices,
    selectedDeviceId,
    stream,
    requestPermission,
    selectDevice,
    stopCapture,
  };
}
