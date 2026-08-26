// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type BackCapableRouter, goBack } from './goBack';

function createRouter() {
  return {
    back: vi.fn<() => void>(),
    replace: vi.fn<(href: string) => void>(),
  } satisfies BackCapableRouter;
}

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, 'length', {
    configurable: true,
    get: () => length,
  });
}

afterEach(() => {
  // 인스턴스에 덮어쓴 length getter를 제거해 프로토타입 getter로 복원한다.
  delete (window.history as unknown as Record<string, unknown>).length;
});

describe('goBack', () => {
  it('calls router.back() when there is in-app history', () => {
    setHistoryLength(3);
    const router = createRouter();

    goBack(router);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to replace("/") when there is no history to go back to', () => {
    setHistoryLength(1);
    const router = createRouter();

    goBack(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('uses the provided fallback href', () => {
    setHistoryLength(1);
    const router = createRouter();

    goBack(router, '/dashboard');

    expect(router.replace).toHaveBeenCalledWith('/dashboard');
  });
});
