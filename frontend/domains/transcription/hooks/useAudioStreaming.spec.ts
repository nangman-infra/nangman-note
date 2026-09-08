// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useAudioStreaming } from './useAudioStreaming';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const originalAudioContext = globalThis.AudioContext;
const originalAudioWorkletNode = globalThis.AudioWorkletNode;
let addModule: (url: string) => Promise<void>;
let audioContexts: MockAudioContext[];

class MockAudioContext {
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  audioWorklet = {
    addModule: vi.fn((url: string) => addModule(url)),
  } as unknown as AudioWorklet;
  source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  gain = {
    gain: { value: 1 },
    connect: vi.fn(),
  };
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  resume = vi.fn(async () => undefined);

  constructor() {
    audioContexts.push(this);
  }

  createMediaStreamSource() {
    return this.source as unknown as MediaStreamAudioSourceNode;
  }

  createGain() {
    return this.gain as unknown as GainNode;
  }
}

class MockAudioWorkletNode {
  port = {
    onmessage: null,
    postMessage: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  audioContexts = [];
  addModule = vi.fn(() => Promise.resolve());
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });
  Object.defineProperty(globalThis, 'AudioWorkletNode', {
    configurable: true,
    value: MockAudioWorkletNode,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: originalAudioContext,
  });
  Object.defineProperty(globalThis, 'AudioWorkletNode', {
    configurable: true,
    value: originalAudioWorkletNode,
  });
  document.head
    .querySelector('link[data-audio-worklet-preload="true"]')
    ?.remove();
});

function createSocket() {
  return {
    connected: true,
    emit: vi.fn(),
  } as unknown as Socket;
}

describe('useAudioStreaming', () => {
  it('creates only one audio pipeline for concurrent start calls', async () => {
    const moduleLoad = deferred();
    vi.mocked(addModule).mockImplementation(() => moduleLoad.promise);
    const { result } = renderHook(() => useAudioStreaming());
    const stream = {} as MediaStream;
    const socket = createSocket();
    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = result.current.startStreaming(stream, socket);
      second = result.current.startStreaming(stream, socket);
    });

    expect(audioContexts).toHaveLength(1);
    expect(addModule).toHaveBeenCalledOnce();

    await act(async () => {
      moduleLoad.resolve();
      await Promise.all([first, second]);
    });

    expect(audioContexts).toHaveLength(1);
    expect(result.current.state).toBe('streaming');
  });

  it('clears the start guard after failure so a later retry can start', async () => {
    vi.mocked(addModule)
      .mockRejectedValueOnce(new Error('worklet load failed'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAudioStreaming());
    const stream = {} as MediaStream;
    const socket = createSocket();

    await act(async () => {
      await result.current.startStreaming(stream, socket);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('worklet load failed');
    expect(audioContexts[0]?.close).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.startStreaming(stream, socket);
    });

    expect(audioContexts).toHaveLength(2);
    expect(result.current.state).toBe('streaming');
    expect(result.current.error).toBeNull();
  });
});
