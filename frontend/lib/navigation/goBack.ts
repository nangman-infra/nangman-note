'use client';

/**
 * Minimal router surface needed for back navigation.
 * Structurally compatible with next/navigation's useRouter() return value.
 */
export interface BackCapableRouter {
  back: () => void;
  replace: (href: string) => void;
}

/**
 * Navigate back within the app, falling back to `fallbackHref` (replace, not
 * push) when there is no in-app history to go back to — e.g. the page was
 * opened directly, in a new tab, or from an external link.
 *
 * Using replace for the fallback keeps the history stack clean so the browser
 * Back button never lands on a dead/stale flow.
 */
export function goBack(router: BackCapableRouter, fallbackHref = '/'): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}
