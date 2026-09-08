'use client';

/** 테마(다크 기본 / 라이트) 저장·적용 유틸 */

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'transnote_theme';

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // 무해
  }
  applyTheme(mode);
}

/**
 * SSR 하이드레이션 전에 저장된 테마를 적용하는 인라인 스크립트.
 * 기본 테마는 다크(<html data-theme="dark">). 사용자가 라이트를 저장한 경우에만 전환한다.
 * (FOUC — 다크로 렌더 후 라이트로 깜빡이는 현상 방지)
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}}catch(e){}})();`;
