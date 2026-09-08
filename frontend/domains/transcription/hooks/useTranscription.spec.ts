// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { useTranscription } from './useTranscription';

const mocks = vi.hoisted(() => ({
  createSocket: vi.fn(),
  list: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { accessToken: 'access-token' },
    status: 'authenticated',
  }),
  getSession: vi.fn(),
}));

vi.mock('@/lib/api/websocket', () => ({
  createSocket: mocks.createSocket,
}));

vi.mock('../api/transcriptionApi', () => ({
  transcriptionApi: {
    list: mocks.list,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createMockSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const ioHandlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: true,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    io: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        ioHandlers.set(event, handler);
      }),
    },
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as Socket;
  return { socket, handlers };
}

beforeEach(() => {
  mocks.createSocket.mockReset();
  mocks.list.mockReset();
  useTranscriptionStore.setState({
    segments: [],
    partial: null,
    isConnected: false,
    isTranscriptExpanded: false,
    hasActiveSession: false,
    error: null,
  });
});

describe('useTranscription resync lifecycle', () => {
  it('ignores a stale resync response after unmount', async () => {
    const listRequest = deferred<
      Array<{
        id: string;
        meetingId: string;
        text: string;
        startTime: number;
        endTime: number;
        confidence: number;
        createdAt: string;
      }>
    >();
    const { socket, handlers } = createMockSocket();
    mocks.createSocket.mockReturnValue(socket);
    mocks.list.mockReturnValue(listRequest.promise);

    const { unmount } = renderHook(() =>
      useTranscription('meeting-1', true),
    );

    act(() => {
      handlers.get('connect')?.();
      handlers.get('connect')?.();
    });
    expect(mocks.list).toHaveBeenCalledWith('meeting-1');

    unmount();
    await act(async () => {
      listRequest.resolve([
        {
          id: 'stale-segment',
          meetingId: 'meeting-1',
          text: '이전 회의 응답',
          startTime: 0,
          endTime: 1,
          confidence: 0.9,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      await listRequest.promise;
      await Promise.resolve();
    });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(useTranscriptionStore.getState().segments).toEqual([]);
  });
});
