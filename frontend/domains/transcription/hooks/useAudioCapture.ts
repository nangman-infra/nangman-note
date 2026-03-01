'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export type AudioCapturePermission = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface UseAudioCaptureReturn {
  permission: AudioCapturePermission;
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  requestPermission: () => Promise<boolean>;
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
    async (): Promise<boolean> => {
      if (!isMediaDevicesSupported()) {
        setPermission('unsupported');
        return false;
      }

      // 이전 스트림이 남아있으면 정리
      stopCapture();

      const audioConstraints: MediaTrackConstraints = {
        // 장치 선택
        ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
        // 전사 품질 개선을 위한 기본 DSP 옵션
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setPermission('granted');

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
        }

        return true;
      } catch (error) {
        if (error instanceof DOMException) {
          if (
            error.name === 'NotAllowedError' ||
            error.name === 'PermissionDeniedError'
          ) {
            setPermission('denied');
            return false;
          }
        }
        setPermission('denied');
        return false;
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
    devices,
    selectedDeviceId,
    stream,
    requestPermission,
    selectDevice,
    stopCapture,
  };
}
