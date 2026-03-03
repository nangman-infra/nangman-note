// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioCapture } from './useAudioCapture';

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
);

function createMockStream(deviceId = 'device-1'): MediaStream {
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

function mockMediaDevices(options: {
  getUserMedia: () => Promise<MediaStream>;
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
}) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(options.getUserMedia),
      enumerateDevices: vi.fn(
        options.enumerateDevices ??
          (() =>
            Promise.resolve([
              {
                kind: 'audioinput',
                deviceId: 'device-1',
                label: '내장 마이크',
              } as MediaDeviceInfo,
            ])),
      ),
    },
  });
}

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
  }
});

describe('useAudioCapture', () => {
  it('classifies permission-denied errors as denied', async () => {
    mockMediaDevices({
      getUserMedia: () =>
        Promise.reject(new DOMException('denied', 'NotAllowedError')),
    });

    const { result } = renderHook(() => useAudioCapture());
    let response: Awaited<ReturnType<typeof result.current.requestPermission>>;

    await act(async () => {
      response = await result.current.requestPermission();
    });

    expect(response!).toEqual({ granted: false, reason: 'denied' });
    expect(result.current.permission).toBe('denied');
    expect(result.current.error).toContain('차단');
  });

  it('keeps permission as prompt for device-not-found errors', async () => {
    mockMediaDevices({
      getUserMedia: () =>
        Promise.reject(new DOMException('no device', 'NotFoundError')),
    });

    const { result } = renderHook(() => useAudioCapture());
    let response: Awaited<ReturnType<typeof result.current.requestPermission>>;

    await act(async () => {
      response = await result.current.requestPermission();
    });

    expect(response!).toEqual({ granted: false, reason: 'device-not-found' });
    expect(result.current.permission).toBe('prompt');
    expect(result.current.error).toContain('마이크');
  });

  it('returns granted on successful capture and updates permission', async () => {
    mockMediaDevices({
      getUserMedia: () => Promise.resolve(createMockStream()),
    });

    const { result } = renderHook(() => useAudioCapture());
    let response: Awaited<ReturnType<typeof result.current.requestPermission>>;

    await act(async () => {
      response = await result.current.requestPermission();
    });

    expect(response!).toEqual({ granted: true });
    expect(result.current.permission).toBe('granted');
    expect(result.current.error).toBeNull();
  });
});
