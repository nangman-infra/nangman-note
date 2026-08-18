'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_AUDIO_INPUT_SOURCE,
} from '../types/audio-input.types';
import {
  createAudioConstraints,
  enumerateAudioDevices,
  isMediaDevicesSupported,
  isSupportedAudioInputSource,
  type AudioCapturePermission,
  type AudioCaptureRequest,
  type AudioCaptureRequestResult,
  type AudioDevice,
} from '../lib/audioCaptureUtils';

export type {
  AudioCaptureFailureReason,
  AudioCapturePermission,
  AudioCaptureRequest,
  AudioCaptureRequestResult,
  AudioDevice,
} from '../lib/audioCaptureUtils';

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

export function useAudioCapture(): UseAudioCaptureReturn {
  const [permission, setPermission] = useState<AudioCapturePermission>(() =>
    isMediaDevicesSupported() ? 'prompt' : 'unsupported',
  );
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  /** 트랙이 외부 요인으로 끊겼을 때 자동 복구를 1회만 시도하기 위한 가드 */
  const autoRecoveryAttemptedRef = useRef(false);
  const requestPermissionRef = useRef<
    ((request?: AudioCaptureRequest | string) => Promise<AudioCaptureRequestResult>) | null
  >(null);

  const stopCapture = useCallback(() => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  /**
   * 마이크 트랙 상태 감시:
   * - ended: OS 권한 회수·기기 분리·화면 잠금 등으로 캡처가 중단된 경우.
   *   사용자에게 알리고 1회 자동 재획득을 시도한다.
   * - mute/unmute: 무음 캡처 상태를 배너로 노출해 "녹음 중인데 소리가 없는"
   *   구간을 사용자가 인지할 수 있게 한다.
   */
  const attachTrackMonitors = useCallback((mediaStream: MediaStream) => {
    for (const track of mediaStream.getAudioTracks()) {
      if (typeof track.addEventListener !== 'function') continue;
      track.addEventListener('ended', () => {
        // 의도적 stopCapture(track.stop())는 ended 이벤트를 발생시키지 않으므로
        // 여기 도달했다면 외부 요인으로 캡처가 끊긴 것이다.
        if (streamRef.current !== mediaStream) return;

        streamRef.current = null;
        setStream(null);
        setError(
          '마이크 입력이 중단되었습니다. 자동으로 다시 연결을 시도합니다. 실패하면 마이크 연결 상태를 확인해주세요.',
        );

        if (!autoRecoveryAttemptedRef.current) {
          autoRecoveryAttemptedRef.current = true;
          void requestPermissionRef.current?.().then((result) => {
            if (result.granted) {
              setError(null);
            }
          });
        }
      });

      track.addEventListener('mute', () => {
        if (streamRef.current !== mediaStream) return;
        setError(
          '마이크가 일시적으로 음소거 상태입니다. 화면 잠금이나 다른 앱의 마이크 사용 여부를 확인해주세요.',
        );
      });

      track.addEventListener('unmute', () => {
        if (streamRef.current !== mediaStream) return;
        setError(null);
      });
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

      const audioConstraints = createAudioConstraints(effectiveDeviceId ?? undefined);

      if (!isSupportedAudioInputSource(inputSource)) {
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
        autoRecoveryAttemptedRef.current = false;
        attachTrackMonitors(mediaStream);

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
    [selectedDeviceId, stopCapture, attachTrackMonitors],
  );

  // requestPermission을 track ended 핸들러에서 참조할 수 있도록 ref에 연결
  useEffect(() => {
    requestPermissionRef.current = requestPermission;
  }, [requestPermission]);

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
