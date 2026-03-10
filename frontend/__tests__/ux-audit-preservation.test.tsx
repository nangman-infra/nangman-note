/**
 * UX Audit Preservation Property Tests
 *
 * These tests verify that existing CORRECT behaviors are preserved.
 * They are designed to PASS on UNFIXED code — they test non-buggy functionality.
 *
 * After each fix phase, re-run these tests to ensure no regressions.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15**
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 3.1: SSO 로그인 성공 → callbackUrl 리다이렉트 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.1 — SSO login success redirects via callbackUrl', () => {
  it('should call signIn with callbackUrl from searchParams', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/auth/signin/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // The sign-in page should read callbackUrl from searchParams and pass it to signIn
    expect(source).toContain('callbackUrl');
    expect(source).toContain('signIn');
    expect(source).toMatch(/searchParams\.get\s*\(\s*['"]callbackUrl['"]\s*\)/);
  });

  it('should have normalizeCallbackUrl that defaults to "/" for safety', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/auth/signin/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // normalizeCallbackUrl should exist and return '/' as fallback
    expect(source).toContain('normalizeCallbackUrl');
    expect(source).toMatch(/return\s+['"]\/['"]/);
  });
});

// ---------------------------------------------------------------------------
// 3.2: 데스크톱(1280px+) 3-column 레이아웃 고정 비율 유지
// ---------------------------------------------------------------------------
describe('Preservation 3.2 — Desktop 3-column layout with fixed proportions', () => {
  it('should render xl:grid-cols-[280px_360px_minmax(0,1fr)] for desktop layout at 1280px+', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../components/layout/ThreeColumnLayout.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // Desktop layout at xl (1280px+) should have the 3-column grid with fixed sidebar(280px) + list(360px) + viewer(flex)
    expect(source).toContain('xl:grid-cols-[280px_360px_minmax(0,1fr)]');
  });

  it('should use aside/section/main semantic elements for the three columns', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../components/layout/ThreeColumnLayout.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('<aside');
    expect(source).toContain('<section');
    expect(source).toContain('<main');
  });
});

// ---------------------------------------------------------------------------
// 3.3: 회의 목록 클릭 → ResultViewer 표시 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.3 — Meeting list click shows ResultViewer', () => {
  it('should pass onSelectMeeting callback to MeetingList', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // page.tsx should pass onSelectMeeting to MeetingList
    expect(source).toMatch(/onSelectMeeting\s*=\s*\{/);
  });

  it('should render ResultViewer when selectedMeetingId is set', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // When selectedMeetingId is truthy, ResultViewer should be rendered
    expect(source).toContain('selectedMeetingId');
    expect(source).toContain('<ResultViewer');
  });

  it('should invoke onSelectMeeting with meeting.id on card click in MeetingList', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // MeetingCard onClick should call onSelectMeeting with the meeting id
    expect(source).toMatch(new RegExp('onClick\\s*=\\s*\\{.*onSelectMeeting\\?\\.\\(meeting\\.id\\)', 's'));
  });
});

// ---------------------------------------------------------------------------
// 3.4: 서버 검색 API 호출 및 결과 표시 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.4 — Server search API call and result display', () => {
  it('should call searchMeetings on form submit', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // The search form should call searchMeetings
    expect(source).toContain('searchMeetings');
    expect(source).toContain('handleSearchSubmit');
    expect(source).toMatch(/onSubmit\s*=\s*\{handleSearchSubmit\}/);
  });

  it('should have a server-side search API endpoint in meetingApi', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/api/meetingApi.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // meetingApi should have a search method that calls the server
    expect(source).toContain("'/api/v1/meetings/search'");
    expect(source).toMatch(/search:\s*async/);
  });
});

// ---------------------------------------------------------------------------
// 3.5: Cmd/Ctrl+K 검색 포커스 단축키 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.5 — Cmd/Ctrl+K keyboard shortcut focuses search', () => {
  it('should listen for Cmd/Ctrl+K keydown and focus the search input', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // Should have a keydown listener that checks for metaKey/ctrlKey + 'k'
    expect(source).toMatch(/event\.metaKey\s*\|\|\s*event\.ctrlKey/);
    expect(source).toMatch(/event\.key\.toLowerCase\(\)\s*===\s*['"]k['"]/);
    expect(source).toContain('inputRef.current?.focus()');
  });
});

// ---------------------------------------------------------------------------
// 3.6: 새 회의 시작 버튼 클릭 동작 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.6 — New meeting start button works correctly', () => {
  it('should call startMeeting API and navigate to in-progress page', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/meeting/new/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // handleStart should call startMeeting and router.push to in-progress
    expect(source).toContain('startMeeting');
    expect(source).toContain('handleStart');
    expect(source).toMatch(/router\.push\s*\(\s*`\/meeting\/in-progress/);
  });

  it('should have a meeting create API that posts to the server', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/api/meetingApi.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toMatch(/create:\s*async/);
    expect(source).toContain("'/api/v1/meetings'");
    expect(source).toContain('apiClient.post');
  });
});

// ---------------------------------------------------------------------------
// 3.7: 노트 3초 디바운스 자동 저장 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.7 — Note 3-second debounce auto-save', () => {
  it('should use useDebounce with 3000ms for note content', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/note/hooks/useNote.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // useNote should debounce noteContent with 3000ms
    expect(source).toContain('useDebounce');
    expect(source).toContain('3000');
    expect(source).toMatch(/useDebounce\s*\(\s*noteContent\s*,\s*3000\s*\)/);
  });

  it('should auto-save when debounced content changes', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/note/hooks/useNote.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // Should call saveNote when debouncedContent changes
    expect(source).toContain('debouncedContent');
    expect(source).toContain('saveNote');
    // The auto-save effect should check that content actually changed
    expect(source).toContain('lastPersistedContentRef');
  });

  it('should display last saved time in NoteEditor', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/note/components/NoteEditor.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // NoteEditor should show saving status and last saved time
    expect(source).toContain('자동 저장 중');
    expect(source).toContain('lastSaved');
    expect(source).toContain('마지막 저장');
  });
});

// ---------------------------------------------------------------------------
// 3.8: 배치 전사 완료 → AI 회의록 자동 생성 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.8 — Batch transcription completion triggers AI result generation', () => {
  it('should trigger batch transcription job after audio upload on meeting end', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/meeting/in-progress/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // After meeting end, should upload audio and queue batch job
    expect(source).toContain('uploadAudio');
    expect(source).toContain('queueBatchJob');
    expect(source).toContain('shouldRunBatchTranscription');
  });

  it('should auto-refresh result when isPending via polling', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/hooks/useResult.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // useResult should poll for result when isPending
    expect(source).toContain('isPending');
    expect(source).toContain('setInterval');
    expect(source).toMatch(/fetchResult\s*\(\s*meetingId\s*,\s*\{\s*silent:\s*true\s*\}/);
  });
});

// ---------------------------------------------------------------------------
// 3.9: 회의록 편집 후 저장 동작 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.9 — Result editing and save works correctly', () => {
  it('should have edit mode toggle and save handler in ResultViewer', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/components/ResultViewer.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // ResultViewer should have isEditing state and handleSave
    expect(source).toContain('isEditing');
    expect(source).toContain('handleSave');
    expect(source).toContain('handleStartEdit');
    expect(source).toContain('updateResult');
  });

  it('should show success toast after saving', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/components/ResultViewer.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // After successful save, should push a success toast
    expect(source).toContain('회의록 편집 내용이 저장되었습니다');
    expect(source).toMatch(new RegExp("pushToast\\s*\\(\\s*\\{[^}]*variant:\\s*['\"]success['\"]", 's'));
  });
});

// ---------------------------------------------------------------------------
// 3.10: 프롬프트 CRUD 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.10 — Prompt CRUD operations work correctly', () => {
  it('should have create, update, delete methods in promptStore', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/prompt/stores/promptStore.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('createPrompt');
    expect(source).toContain('updatePrompt');
    expect(source).toContain('deletePrompt');
    expect(source).toContain('fetchPrompts');
  });

  it('should call server API for each CRUD operation', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/prompt/stores/promptStore.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('promptApi.list');
    expect(source).toContain('promptApi.create');
    expect(source).toContain('promptApi.update');
    expect(source).toContain('promptApi.delete');
  });

  it('should update local state after successful CRUD', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/prompt/stores/promptStore.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // After create, should add to prompts array
    expect(source).toMatch(/prompts:\s*\[\.\.\.\s*state\.prompts\s*,\s*newPrompt\s*\]/);
    // After delete, should filter out the deleted prompt
    expect(source).toMatch(/prompts:\s*state\.prompts\.filter/);
  });
});

// ---------------------------------------------------------------------------
// 3.11: 회의 휴지통 이동/영구 삭제 동작 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.11 — Meeting trash move and permanent delete with confirmation', () => {
  it('should show confirmation dialog before delete actions', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // Should use MeetingActionDialog for confirmation
    expect(source).toContain('MeetingActionDialog');
    expect(source).toContain('pendingAction');
    expect(source).toContain('handleConfirmAction');
  });

  it('should have move-to-trash and purge action types', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain("'move-to-trash'");
    expect(source).toContain("'purge'");
    expect(source).toContain('deleteMeeting');
    expect(source).toContain('purgeMeeting');
  });

  it('should have restore functionality in trash view', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('restoreMeeting');
    expect(source).toContain('회의를 복구했습니다');
  });
});

// ---------------------------------------------------------------------------
// 3.12: 다중 선택 일괄 작업 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.12 — Multi-select bulk operations work correctly', () => {
  it('should have selection mode with selectedIds state', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('selectionMode');
    expect(source).toContain('selectedIds');
    expect(source).toContain('toggleSelect');
    expect(source).toContain('selectAll');
    expect(source).toContain('deselectAll');
  });

  it('should have bulk delete, restore, and purge handlers', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('handleBulkDelete');
    expect(source).toContain('handleBulkRestore');
    expect(source).toContain('handleBulkPurge');
    expect(source).toContain('bulkDeleteMeetings');
    expect(source).toContain('bulkRestoreMeetings');
    expect(source).toContain('bulkPurgeMeetings');
  });

  it('should show toast with result count after bulk operations', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/meeting/components/MeetingList.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // Should show count of succeeded items in toast
    expect(source).toContain('result.succeeded.length');
    expect(source).toContain('휴지통으로 이동했습니다');
  });
});

// ---------------------------------------------------------------------------
// 3.13: prefers-reduced-motion: reduce 시 애니메이션 비활성화 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.13 — prefers-reduced-motion disables animations', () => {
  it('should have a prefers-reduced-motion media query in globals.css', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = await fs.readFile(cssPath, 'utf-8');

    // globals.css should have a prefers-reduced-motion rule
    expect(cssContent).toContain('prefers-reduced-motion: reduce');
  });

  it('should set animation-duration and transition-duration to near-zero', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const cssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = await fs.readFile(cssPath, 'utf-8');

    // Inside the reduced-motion block, durations should be set to 0.01ms
    expect(cssContent).toContain('animation-duration: 0.01ms');
    expect(cssContent).toContain('transition-duration: 0.01ms');
    expect(cssContent).toContain('animation-iteration-count: 1');
  });
});

// ---------------------------------------------------------------------------
// 3.14: 실시간 전사 모드 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.14 — Realtime transcription mode works correctly', () => {
  it('should have realtime transcription mode with segments and partial display', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/transcription/components/TranscriptPanel.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // TranscriptPanel should display segments and partial text
    expect(source).toContain('segments');
    expect(source).toContain('partial');
    expect(source).toContain('isRealtimeMode');
    expect(source).toContain('실시간 전사');
  });

  it('should have auto-follow (live scroll) functionality', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/transcription/components/TranscriptPanel.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    // Should have followLive state and auto-scroll behavior
    expect(source).toContain('followLive');
    expect(source).toContain('scrollToBottom');
    expect(source).toContain('자동 스크롤');
  });

  it('should use audio streaming for realtime mode in in-progress page', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../app/meeting/in-progress/page.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('useAudioStreaming');
    expect(source).toContain('startStreaming');
    expect(source).toContain('isRealtimeMode');
  });
});

// ---------------------------------------------------------------------------
// 3.15: 재생성 실행 후 결과 자동 업데이트 정상
// ---------------------------------------------------------------------------
describe('Preservation 3.15 — Regeneration auto-updates result', () => {
  it('should have regenerate functionality in ResultViewer', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/components/ResultViewer.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('handleRegenerate');
    expect(source).toContain('regenerateResult');
    expect(source).toContain('showRegenerate');
    expect(source).toContain('재생성 실행');
  });

  it('should show success toast and auto-update after regeneration', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/components/ResultViewer.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    expect(source).toContain('AI가 회의록을 재생성하고 있습니다');
    expect(source).toContain('완료되면 자동으로 결과가 업데이트됩니다');
  });

  it('should poll for result updates during regeneration', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, '../domains/result/hooks/useResult.ts');
    const source = await fs.readFile(filePath, 'utf-8');

    // useResult should poll during regeneration
    expect(source).toContain('isRegenerating');
    // Should have a polling interval for regeneration
    expect(source).toMatch(new RegExp('isRegenerating.*setInterval', 's'));
  });
});
