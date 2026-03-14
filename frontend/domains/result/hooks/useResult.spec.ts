// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResult } from './useResult';

const useMeetingStatusMock = vi.hoisted(() => vi.fn());
const useResultStoreMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useMeetingStatus', () => ({
  useMeetingStatus: useMeetingStatusMock,
}));

vi.mock('../stores/resultStore', () => ({
  useResultStore: useResultStoreMock,
}));

describe('useResult', () => {
  const fetchResult = vi.fn().mockResolvedValue(undefined);
  const clearResult = vi.fn();
  const updateResult = vi.fn().mockResolvedValue(true);
  const regenerateResult = vi.fn().mockResolvedValue(true);
  const exportPDF = vi.fn().mockResolvedValue(true);
  const exportDOCX = vi.fn().mockResolvedValue(true);

  function mockStore(overrides: Partial<ReturnType<typeof buildState>> = {}) {
    useResultStoreMock.mockReturnValue({
      ...buildState(),
      ...overrides,
    });
  }

  function setVisibilityState(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setVisibilityState('visible');
    mockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls pending results while the page is visible', () => {
    mockStore({ isPending: true });

    renderHook(() => useResult('meeting-1'));

    expect(fetchResult).toHaveBeenCalledTimes(1);
    expect(fetchResult).toHaveBeenNthCalledWith(1, 'meeting-1');

    vi.advanceTimersByTime(5000);

    expect(fetchResult).toHaveBeenCalledTimes(2);
    expect(fetchResult).toHaveBeenNthCalledWith(2, 'meeting-1', {
      silent: true,
    });
  });

  it('stops pending polling while hidden and refetches once when visible again', () => {
    mockStore({ isPending: true });

    renderHook(() => useResult('meeting-1'));

    expect(fetchResult).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchResult).toHaveBeenCalledTimes(2);

    setVisibilityState('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(fetchResult).toHaveBeenCalledTimes(2);

    setVisibilityState('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(fetchResult.mock.calls.length).toBeGreaterThan(2);
    expect(fetchResult.mock.calls.at(-1)).toEqual([
      'meeting-1',
      { silent: true },
    ]);
  });

  it('stops regenerate fallback polling after the page becomes hidden', () => {
    mockStore({ isRegenerating: true });

    renderHook(() => useResult('meeting-1'));

    expect(fetchResult).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchResult).toHaveBeenCalledTimes(2);

    setVisibilityState('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(fetchResult).toHaveBeenCalledTimes(2);
  });

  function buildState() {
    return {
      result: null,
      isLoading: false,
      isRegenerating: false,
      isPending: false,
      isMissingMeeting: false,
      error: null,
      fetchResult,
      updateResult,
      regenerateResult,
      exportPDF,
      exportDOCX,
      clearResult,
    };
  }
});
