// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { act } from 'react';
import { useHistoryBackGuard } from './useHistoryBackGuard';

/** 실제 브라우저의 뒤로가기처럼 sentinel 이 pop 된 상태를 시뮬레이션 */
function simulateBackNavigation() {
  window.history.replaceState(null, '', window.location.href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('useHistoryBackGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 이전 테스트의 sentinel state 제거
    window.history.replaceState(null, '', window.location.href);
  });

  afterEach(() => {
    cleanup();
  });

  it('가드 활성 시 sentinel 을 push 하고 뒤로가기를 차단한다', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const onBlocked = vi.fn();

    renderHook(() => useHistoryBackGuard(true, onBlocked));

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(
      { __backGuard: true },
      '',
      window.location.href,
    );

    act(() => {
      simulateBackNavigation();
    });

    // sentinel 재장전 + 콜백 호출
    expect(pushStateSpy).toHaveBeenCalledTimes(2);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('sentinel 이 이미 있으면 중복 push 하지 않는다', () => {
    const onBlocked = vi.fn();
    window.history.pushState({ __backGuard: true }, '', window.location.href);
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    renderHook(() => useHistoryBackGuard(true, onBlocked));

    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('가드 비활성 시 sentinel 을 만들지 않고 popstate 를 통과시킨다', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const onBlocked = vi.fn();

    renderHook(() => useHistoryBackGuard(false, onBlocked));

    act(() => {
      simulateBackNavigation();
    });

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('가드 해제 시 popstate 리스너를 정리한다', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const onBlocked = vi.fn();

    const { rerender } = renderHook(
      ({ block }: { block: boolean }) => useHistoryBackGuard(block, onBlocked),
      { initialProps: { block: true } },
    );

    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    rerender({ block: false });

    act(() => {
      simulateBackNavigation();
    });

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('최신 onBlocked 콜백을 호출한다', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useHistoryBackGuard(true, cb),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    act(() => {
      simulateBackNavigation();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
