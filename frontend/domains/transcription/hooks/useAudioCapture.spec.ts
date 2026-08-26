// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioCapture } from './useAudioCapture';

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
);

function createMockStream(deviceId = 'device-1'): MediaStream {
  const listeners = new Map<string, Array<() => void>>();
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    }),
    removeEventListener: vi.fn(),
    dispatch: (type: string) => {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  } as unknown as MediaStreamTrack & { dispatch: (type: string) => void };

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

  it('rejects unsupported future input sources without opening the mic', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(createMockStream()));
    mockMediaDevices({ getUserMedia });

    const { result } = renderHook(() => useAudioCapture());
    let response: Awaited<ReturnType<typeof result.current.requestPermission>>;

    await act(async () => {
      response = await result.current.requestPermission({
        inputSource: 'meeting-audio-mix',
      });
    });

    expect(response!).toEqual({ granted: false, reason: 'unsupported' });
    expect(result.current.error).toContain('마이크 입력만 지원');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('attempts automatic recovery when the mic track ends unexpectedly', async () => {
    const firstStream = createMockStream();
    const secondStream = createMockStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);
    mockMediaDevices({ getUserMedia });

    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.stream).toBe(firstStream);

    // 외부 요인으로 트랙이 끊긴 상황 (OS 권한 회수, 기기 분리 등)
    await act(async () => {
      const track = firstStream.getAudioTracks()[0] as MediaStreamTrack & {
        dispatch: (type: string) => void;
      };
      track.dispatch('ended');
      // 자동 복구 getUserMedia가 처리될 시간을 준다
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(result.current.stream).toBe(secondStream);
    expect(result.current.error).toBeNull();
  });

  it('keeps the newest concurrent capture and stops a stale stream', async () => {
    const first = deferred<MediaStream>();
    const second = deferred<MediaStream>();
    const firstStream = createMockStream('device-1');
    const secondStream = createMockStream('device-2');
    mockMediaDevices({
      getUserMedia: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise),
    });
    const { result } = renderHook(() => useAudioCapture());

    let firstRequest!: ReturnType<typeof result.current.requestPermission>;
    let secondRequest!: ReturnType<typeof result.current.requestPermission>;
    act(() => {
      firstRequest = result.current.requestPermission('device-1');
      secondRequest = result.current.requestPermission('device-2');
    });
    await act(async () => {
      second.resolve(secondStream);
      await secondRequest;
    });
    await act(async () => {
      first.resolve(firstStream);
      await firstRequest;
    });

    expect(result.current.stream).toBe(secondStream);
    expect(firstStream.getTracks()[0].stop).toHaveBeenCalledOnce();
    expect(secondStream.getTracks()[0].stop).not.toHaveBeenCalled();
  });
});
