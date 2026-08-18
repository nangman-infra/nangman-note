'use client';

/** 테마(라이트/다크) 저장·적용 유틸 */

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'transnote_theme';

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
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
 * (FOUC — 라이트로 렌더 후 다크로 깜빡이는 현상 방지)
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'){document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;
