/**
 * UX Audit Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED correct behavior for each identified bug.
 * They are designed to FAIL on unfixed code — failure confirms the bugs exist.
 *
 * DO NOT fix the code or the tests when they fail.
 * The goal is to surface counterexamples that demonstrate the bugs.
 *
 * **Validates: Requirements 1.37, 1.7, 1.14, 1.36, 1.21, A-1, B-2, D-3**
 */

import { describe, it, expect } from 'vitest';

async function readSources(...relativePaths: string[]): Promise<string> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const sources = await Promise.all(
    relativePaths.map((relativePath) =>
      fs.readFile(path.resolve(__dirname, relativePath), 'utf-8'),
    ),
  );

  return sources.join('\n');
}

async function readGlobalStyleSources(): Promise<string> {
  return readSources(
    '../app/globals.css',
    '../app/_styles/theme.css',
    '../app/_styles/surfaces.css',
    '../app/_styles/controls.css',
    '../app/_styles/motion.css',
    '../app/_styles/result-markdown.css',
    '../app/_styles/markdown-editor.css',
    '../app/_styles/status-pill.css',
  );
}

// ---------------------------------------------------------------------------
// 1. CSS Specificity (1.37)
//    .btn-neo should be inside @layer components and NOT hardcode display
// ---------------------------------------------------------------------------
describe('Bug 1.37 — CSS Specificity: .btn-neo should not override Tailwind utilities', () => {
  it('should have .btn-neo defined inside @layer components so Tailwind utilities can override it', async () => {
    const cssContent = await readGlobalStyleSources();

    // The .btn-neo block should be wrapped in @layer components { ... }
    const layerComponentsRegex = /@layer\s+components\s*\{[^}]*\.btn-neo\s*\{/;
    expect(cssContent).toMatch(layerComponentsRegex);
  });

  it('should NOT hardcode display: inline-flex in .btn-neo', async () => {
    const cssContent = await readGlobalStyleSources();

    // Extract the .btn-neo block
    const btnNeoMatch = cssContent.match(/\.btn-neo\s*\{([^}]*)\}/);
    expect(btnNeoMatch).not.toBeNull();

    const btnNeoBody = btnNeoMatch![1];
    // display: inline-flex should NOT be hardcoded — it should be via Tailwind utility
    const hasHardcodedDisplay = /display\s*:\s*inline-flex/.test(btnNeoBody);
    expect(hasHardcodedDisplay).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Compact Auto-Switch (1.7)
//    In compact mode, selecting a meeting should auto-switch activeColumn to 'viewer'
// ---------------------------------------------------------------------------
describe('Bug 1.7 — Compact mode: meeting selection should auto-switch to viewer tab', () => {
  it('should switch activeColumn to viewer when a meeting is selected in compact mode', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../components/layout/ThreeColumnLayout.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // The component should have logic that switches to 'viewer' when a meeting is selected.
    // In the current (unfixed) code, onSelectMeeting only sets the meeting ID but does NOT
    // call setActiveColumn('viewer') in compact mode.
    //
    // Expected: There should be a mechanism (context, callback, or effect) that sets
    // activeColumn to 'viewer' when a meeting is selected in compact mode.
    // We check for evidence of this auto-switch pattern.
    const hasAutoSwitchToViewer =
      // Pattern 1: setActiveColumn('viewer') triggered by meeting selection
      /onSelectMeeting[\s\S]*setActiveColumn[\s\S]*viewer/.test(source) ||
      // Pattern 2: useEffect watching selectedMeetingId to switch to viewer
      /selectedMeeting[\s\S]*setActiveColumn\s*\(\s*['"]viewer['"]\s*\)/.test(source) ||
      // Pattern 3: LayoutContext providing setActiveColumn for child components
      /LayoutContext|layoutContext/i.test(source) && /setActiveColumn/i.test(source);

    expect(hasAutoSwitchToViewer).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Background Polling (1.14)
//    Polling should stop when document.visibilityState === 'hidden'
// ---------------------------------------------------------------------------
describe('Bug 1.14 — Background polling should stop when tab is hidden', () => {
  it('should check document.visibilityState or use Page Visibility API in polling logic', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../domains/meeting/components/MeetingList.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The polling useEffect should reference visibilityState or visibilitychange
    // to skip polling when the tab is in the background.
    const hasVisibilityCheck =
      source.includes('visibilityState') ||
      source.includes('visibilitychange') ||
      source.includes('document.hidden');

    expect(hasVisibilityCheck).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Dialog Accessibility (1.36)
//    PromptEditorDialog should use <dialog> element, not <div>
// ---------------------------------------------------------------------------
describe('Bug 1.36 — PromptEditorDialog should use <dialog> element for accessibility', () => {
  it('should use native <dialog> element instead of <div> overlay', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../domains/prompt/components/PromptEditorDialog.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The component should render a <dialog> element for native ESC key closing,
    // focus trapping, and background scroll prevention.
    // Current (unfixed) code uses <div className="fixed inset-0 ...">
    const usesDialogElement =
      source.includes('<dialog') ||
      (source.includes('role="dialog"') && source.includes('aria-modal="true"'));

    expect(usesDialogElement).toBe(true);
  });

  it('should NOT use a plain <div> as the modal overlay root', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../domains/prompt/components/PromptEditorDialog.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The fixed code should not have <div className="fixed inset-0 ..."> as the modal root
    const usesDivOverlay = /return\s*\(\s*<div\s+className="fixed\s+inset-0/.test(source);
    expect(usesDivOverlay).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Beforeunload Guard (1.21)
//    beforeunload should fire when notes are dirty + mic denied (not just recording)
// ---------------------------------------------------------------------------
describe('Bug 1.21 — beforeunload should guard unsaved notes even without active recording', () => {
  it('should pass note dirty state (not just isActiveRecording) to useBeforeUnloadGuard', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../app/meeting/in-progress/page.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The useBeforeUnloadGuard call should include a check for unsaved notes,
    // not just isActiveRecording.
    // Expected pattern: useBeforeUnloadGuard(isActiveRecording || hasUnsavedNote)
    // or similar that includes note dirty state.
    //
    // Current (unfixed): useBeforeUnloadGuard(isActiveRecording)
    const guardCallMatch = source.match(
      /useBeforeUnloadGuard\s*\(([^)]+)\)/,
    );
    expect(guardCallMatch).not.toBeNull();

    const guardArg = guardCallMatch![1].trim();
    // The argument should reference something beyond just isActiveRecording
    // e.g., isDirty, hasUnsavedNote, unsaved, dirty, noteStore
    const includesNoteDirtyCheck =
      /dirty|unsaved|note/i.test(guardArg) &&
      guardArg !== 'isActiveRecording';

    expect(includesNoteDirtyCheck).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// 6. FTUE (A-1)
//    Empty workspace (0 meetings) should show onboarding card, not generic EmptyViewer
// ---------------------------------------------------------------------------
describe('Bug A-1 — FTUE: empty workspace should show onboarding card', () => {
  it('should have an onboarding component or conditional for zero-meeting state in page.tsx', async () => {
    const source = await readSources(
      '../app/page.tsx',
      '../app/_components/home/HomePageContent.tsx',
      '../app/_components/home/DashboardView.tsx',
    );

    // The page should differentiate between "no meeting selected" and "zero meetings in workspace".
    // Expected: When meetings.length === 0 && !isLoading, show an OnboardingViewer
    // with steps like "새 회의 시작", "노트 작성", "AI 회의록 확인".
    //
    // Current (unfixed): EmptyViewer always shows the same generic content regardless
    // of whether the user has any meetings at all.
    const hasOnboardingLogic =
      source.includes('OnboardingViewer') ||
      source.includes('onboarding') ||
      (source.includes('meetings.length') && source.includes('시작하기'));

    expect(hasOnboardingLogic).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Title Edit (B-2)
//    ResultViewer title should be clickable to enter inline edit mode
// ---------------------------------------------------------------------------
describe('Bug B-2 — ResultViewer title should support inline editing', () => {
  it('should have inline title editing logic in ResultViewer', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../domains/result/components/ResultViewer.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The ResultViewer should have state for editing the title inline.
    // Expected: isEditingTitle state, an <input> for editing, onClick handler on the title.
    //
    // Current (unfixed): Title is rendered as a plain <h2> with no click handler or edit mode.
    const hasEditTitleState =
      source.includes('isEditingTitle') ||
      source.includes('editTitle') ||
      source.includes('setIsEditingTitle');

    expect(hasEditTitleState).toBe(true);
  });

  it('should render the title <h2> with an onClick handler for editing', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      __dirname,
      '../domains/result/components/ResultViewer.tsx',
    );
    const source = await fs.readFile(filePath, 'utf-8');

    // The <h2> title element should have an onClick handler to enter edit mode.
    // Current (unfixed): <h2 className="text-xl font-semibold leading-tight">
    //   {result.metadata?.title || '회의록'}
    // </h2>  — no onClick, no cursor-pointer
    //
    // We specifically check the <h2> tag itself has onClick, not other elements.
    const titleH2HasClickHandler = /<h2[^>]*onClick/.test(source);
    const hasHandleTitleClick = source.includes('handleTitleClick');

    expect(titleH2HasClickHandler || hasHandleTitleClick).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Offline (D-3)
//    navigator.onLine === false should show a global offline banner
// ---------------------------------------------------------------------------
describe('Bug D-3 — Offline detection: should show global offline banner', () => {
  it('should have a NetworkStatusBanner component', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    // The NetworkStatusBanner component should exist
    const bannerPath = path.resolve(
      __dirname,
      '../components/feedback/NetworkStatusBanner.tsx',
    );

    let exists = false;
    try {
      await fs.access(bannerPath);
      exists = true;
    } catch {
      exists = false;
    }

    expect(exists).toBe(true);
  });

  it('should include NetworkStatusBanner in the root layout', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
    const source = await fs.readFile(layoutPath, 'utf-8');

    // The root layout should import and render NetworkStatusBanner
    const hasNetworkBanner =
      source.includes('NetworkStatusBanner') ||
      source.includes('networkStatus') ||
      source.includes('offline');

    expect(hasNetworkBanner).toBe(true);
  });
});
