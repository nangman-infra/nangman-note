import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test('real editor preserves drafts, resolves two-tab conflicts, and downloads notes', async ({ context, page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const date = new Date().toISOString();
  const meeting = { id, title: '브라우저 검증 회의', status: 'completed', promptId: 'prompt_default_meeting', transcriptionMode: 'batch', startedAt: date, endedAt: date, createdAt: date, updatedAt: date };
  let note = { id: 'note-1', meetingId: id, content: '원본 메모', revision: 1, createdAt: date, updatedAt: date };
  let failSaves = false;
  const pageErrors: string[] = [];
  context.on('page', (opened) => opened.on('pageerror', (error) => pageErrors.push(error.message)));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const session = { sub: 'browser-test', name: '테스트 사용자', accessToken: 'browser-test-access-token', accessTokenExpires: Date.now() + 3_600_000 };
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: await encode({ token: session, secret: 'local-browser-test-secret', maxAge: 3600 }),
    domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax',
  }]);
  await context.route('**/api/auth/session', (route) => route.fulfill({ json: { user: { name: session.name }, accessToken: session.accessToken, expires: new Date(Date.now() + 3_600_000).toISOString() } }));
  await context.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (pathname.endsWith('/note')) {
      if (route.request().method() === 'PUT') {
        if (failSaves) { await route.abort('failed'); return; }
        const body = route.request().postDataJSON() as { content: string; expectedRevision: number };
        if (body.expectedRevision !== note.revision) {
          await route.fulfill({ status: 409, json: { error: { statusCode: 409, message: '다른 탭에서 수정됨' } } });
          return;
        }
        note = { ...note, content: body.content, revision: note.revision + 1, updatedAt: new Date().toISOString() };
      }
      data = note;
    } else if (pathname.endsWith('/result')) {
      data = { id: 'result-1', meetingId: id, promptId: meeting.promptId, content: '# 회의록\n\n검증용 결과', createdAt: date, updatedAt: date, metadata: { title: meeting.title, totalDuration: 600, generatedAt: date, transcriptWordCount: 20, noteLength: 5 } };
    } else if (pathname.endsWith('/transcripts')) data = { segments: [] };
    else if (pathname.endsWith('/prompts')) data = [{ id: meeting.promptId, name: '회의', content: '', documentType: 'meeting', isDefault: true }];
    else if (pathname.endsWith('/meetings/stats')) data = { total: 1, completed: 1, recording: 0, processing: 0, totalDuration: 600 };
    else if (pathname.endsWith('/meetings')) data = { meetings: [meeting], pagination: { total: 1 } };
    else if (pathname.endsWith(`/${id}`)) data = meeting;
    await route.fulfill({ json: { success: true, data } });
  });

  const openNote = async (target: typeof page) => {
    await target.goto(`/?meeting=${id}`);
    await target.getByRole('tab', { name: '원본 노트' }).click();
    const editor = target.locator('.toastui-editor-ww-container [contenteditable="true"]');
    await expect(editor).toBeVisible();
    return editor;
  };
  const editor = await openNote(page);
  const second = await context.newPage();
  const secondEditor = await openNote(second);

  await editor.fill('첫 번째 탭의 새 메모');
  await page.getByRole('button', { name: '지금 저장' }).click();
  await expect.poll(() => note.content).toBe('첫 번째 탭의 새 메모');
  await secondEditor.fill('두 번째 탭의 작성 내용');
  await second.getByRole('button', { name: '지금 저장' }).click();
  await expect(second.getByText('동시 편집 충돌', { exact: true })).toBeVisible();
  await expect(secondEditor).toHaveText('두 번째 탭의 작성 내용');
  await second.getByRole('button', { name: '현재 내용으로 저장' }).click();
  await expect.poll(() => note.content).toBe('두 번째 탭의 작성 내용');

  // A reload must recover the last keystroke even before a server save succeeds.
  failSaves = true;
  await secondEditor.fill('새로고침 직전 초안');
  await second.reload();
  await second.getByRole('tab', { name: '원본 노트' }).click();
  await expect(second.locator('.toastui-editor-ww-container [contenteditable="true"]')).toHaveText('새로고침 직전 초안');
  failSaves = false;
  await second.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => note.content).toBe('새로고침 직전 초안');

  const downloadPromise = second.waitForEvent('download');
  await second.getByRole('button', { name: '현재 노트 Markdown 다운로드' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`note-${id}.md`);
  await second.setViewportSize({ width: 390, height: 844 });
  await expect(second.getByRole('button', { name: '현재 노트 Markdown 다운로드' })).toBeVisible();
  await expect(second.locator('.toastui-editor-ww-container [contenteditable="true"]')).toHaveCount(1);
  await second.locator('header').getByRole('button', { name: '대시보드', exact: true }).first().click();
  await second.locator('header').getByRole('button', { name: '문서', exact: true }).click();
  await expect(second.locator('.toastui-editor-ww-container [contenteditable="true"]')).toHaveText('새로고침 직전 초안');
  expect(pageErrors).toEqual([]);
});
