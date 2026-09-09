// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteApi } from '../api/noteApi';
import type { Note } from '../types/note.types';
import { readDrafts, writeDraft } from './noteDrafts';
import { useNoteStore } from './noteStore';

vi.mock('../api/noteApi', () => ({ noteApi: { save: vi.fn(), get: vi.fn() } }));

const note = (content = 'server', revision = 1, meetingId = 'meeting-1'): Note => ({
  id: `note-${meetingId}`, meetingId, content, revision,
  createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z',
});
const store = () => useNoteStore.getState();
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const draft = (content: string, baseRevision: number | null, suffix = 'backup') => ({
  key: `transnote_offline_note_meeting-1:${suffix}`, content, baseRevision, savedAt: Date.now(),
});

describe('durable note sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    store().clearNote();
    vi.mocked(noteApi.get).mockResolvedValue(note());
    vi.mocked(noteApi.save).mockImplementation(async (id, content, revision) => note(content, revision + 1, id));
  });
  afterEach(() => vi.restoreAllMocks());

  it('backs up every edit immediately and restores a deliberate empty edit', async () => {
    await store().loadNote('meeting-1');
    store().setContent('');
    expect(readDrafts('meeting-1')[0]).toMatchObject({ content: '', baseRevision: 1 });
    expect(noteApi.save).not.toHaveBeenCalled();
    store().clearNote();
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ noteContent: '', isDirty: true, restoredFromBackup: true });
    expect(await store().saveNote('meeting-1')).toBe(true);
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', '', 1);
    expect(readDrafts('meeting-1')).toEqual([]);
  });

  it('restores a never-saved note using revision 0 rather than server clock time', async () => {
    writeDraft(draft('first draft', 0));
    vi.mocked(noteApi.get).mockResolvedValue(note('', 0));
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ noteContent: 'first draft', isDirty: true, conflict: null });
    await store().saveNote('meeting-1');
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', 'first draft', 0);
  });

  it('drains edits made during a save and advances the server revision between requests', async () => {
    const first = deferred<Note>();
    await store().loadNote('meeting-1');
    vi.mocked(noteApi.save).mockReturnValueOnce(first.promise);
    store().setContent('first');
    const saving = store().saveNote('meeting-1');
    await Promise.resolve();
    store().setContent('latest');
    const again = store().saveNote('meeting-1');
    expect(noteApi.save).toHaveBeenCalledTimes(1);
    first.resolve(note('first', 2));
    expect(await saving).toBe(true);
    expect(await again).toBe(true);
    expect(noteApi.save).toHaveBeenNthCalledWith(2, 'meeting-1', 'latest', 2);
    expect(store()).toMatchObject({ noteContent: 'latest', isDirty: false, isSaving: false });
    expect(readDrafts('meeting-1')).toEqual([]);
  });

  it('finishes the previous meeting save without corrupting the new meeting', async () => {
    const pending = deferred<Note>();
    await store().loadNote('meeting-1');
    store().setContent('A');
    vi.mocked(noteApi.save).mockReturnValueOnce(pending.promise);
    const saving = store().saveNote('meeting-1');
    await Promise.resolve();
    store().clearNote();
    vi.mocked(noteApi.get).mockResolvedValue(note('B', 1, 'meeting-2'));
    await store().loadNote('meeting-2');
    pending.resolve(note('A', 2));
    await saving;
    expect(store()).toMatchObject({ activeMeetingId: 'meeting-2', noteContent: 'B', isDirty: false });
  });

  it('waits for a pending write when reopening the same meeting', async () => {
    const pending = deferred<Note>();
    await store().loadNote('meeting-1');
    store().setContent('A');
    vi.mocked(noteApi.save).mockReturnValueOnce(pending.promise);
    const saving = store().saveNote('meeting-1');
    await Promise.resolve();
    store().clearNote();
    const reopening = store().loadNote('meeting-1');
    expect(noteApi.get).toHaveBeenCalledTimes(1);
    vi.mocked(noteApi.get).mockResolvedValue(note('A', 2));
    pending.resolve(note('A', 2));
    await saving;
    await reopening;
    expect(store()).toMatchObject({ noteContent: 'A', isDirty: false, conflict: null });
  });

  it('ignores late loads after clear or switching meetings', async () => {
    const pending = deferred<Note>();
    vi.mocked(noteApi.get).mockReturnValueOnce(pending.promise);
    const loading = store().loadNote('meeting-1');
    await Promise.resolve();
    store().clearNote();
    pending.resolve(note('late'));
    await loading;
    expect(store()).toMatchObject({ activeMeetingId: null, noteContent: '' });
  });

  it('keeps text entered during load and requires review instead of overwriting the server', async () => {
    const pending = deferred<Note>();
    vi.mocked(noteApi.get).mockReturnValueOnce(pending.promise);
    const loading = store().loadNote('meeting-1');
    store().setContent('typed');
    pending.resolve(note('existing'));
    await loading;
    expect(store()).toMatchObject({ noteContent: 'typed', isDirty: true, errorKind: 'conflict' });
    expect(await store().saveNote('meeting-1')).toBe(false);
  });

  it('preserves failed writes and retries the same revision', async () => {
    await store().loadNote('meeting-1');
    store().setContent('draft');
    vi.mocked(noteApi.save).mockRejectedValueOnce(new Error('network down'));
    expect(await store().saveNote('meeting-1')).toBe(false);
    expect(store()).toMatchObject({ isDirty: true, retryable: true, saveFailures: 1, error: 'network down' });
    expect(readDrafts('meeting-1')[0].content).toBe('draft');
    expect(await store().saveNote('meeting-1')).toBe(true);
    expect(noteApi.save).toHaveBeenLastCalledWith('meeting-1', 'draft', 1);
  });

  it('does not save after a failed initial read; retrying preserves the offline draft', async () => {
    writeDraft(draft('', 1));
    vi.mocked(noteApi.get).mockRejectedValueOnce(new Error('offline'));
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ restoredFromBackup: true, errorKind: 'load', isDirty: true });
    expect(await store().saveNote('meeting-1')).toBe(false);
    expect(noteApi.save).not.toHaveBeenCalled();
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ noteContent: '', conflict: null, hasLoaded: true });
  });

  it('surfaces divergent drafts as conflicts even when their clock is newer', async () => {
    writeDraft({ ...draft('local', 1), savedAt: Date.now() + 100_000 });
    vi.mocked(noteApi.get).mockResolvedValue(note('remote', 2));
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ noteContent: 'local', errorKind: 'conflict', conflict: { content: 'remote' } });
    expect(await store().saveNote('meeting-1')).toBe(false);
    store().resolveConflict('local');
    await store().saveNote('meeting-1');
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', 'local', 2);
  });

  it('allows choosing the remote version without writing the local draft', async () => {
    writeDraft(draft('local', 1));
    vi.mocked(noteApi.get).mockResolvedValue(note('remote', 2));
    await store().loadNote('meeting-1');
    store().resolveConflict('server');
    expect(store()).toMatchObject({ noteContent: 'remote', isDirty: false, conflict: null });
    expect(readDrafts('meeting-1')).toEqual([]);
    expect(noteApi.save).not.toHaveBeenCalled();
  });

  it('keeps both versions when the server rejects a concurrent write', async () => {
    await store().loadNote('meeting-1');
    store().setContent('local');
    vi.mocked(noteApi.save).mockRejectedValueOnce(Object.assign(new Error('conflict'), { statusCode: 409 }));
    vi.mocked(noteApi.get).mockResolvedValue(note('remote', 2));
    expect(await store().saveNote('meeting-1')).toBe(false);
    expect(store()).toMatchObject({ noteContent: 'local', conflict: { content: 'remote', revision: 2 } });
    expect(readDrafts('meeting-1')[0].content).toBe('local');
  });

  it('keeps a conflict barrier if fetching the remote version also fails', async () => {
    await store().loadNote('meeting-1');
    store().setContent('local');
    vi.mocked(noteApi.save).mockRejectedValueOnce(Object.assign(new Error('conflict'), { statusCode: 409 }));
    vi.mocked(noteApi.get).mockRejectedValueOnce(new Error('offline'));
    await store().saveNote('meeting-1');
    expect(store()).toMatchObject({ errorKind: 'conflict', retryable: false });
    expect(await store().saveNote('meeting-1')).toBe(false);
    expect(noteApi.save).toHaveBeenCalledTimes(1);
  });

  it('does not erase another tab backup on successful save', async () => {
    await store().loadNote('meeting-1');
    store().setContent('mine');
    writeDraft(draft('other tab', 1, 'other-tab'));
    await store().saveNote('meeting-1');
    expect(readDrafts('meeting-1')).toEqual([expect.objectContaining({ content: 'other tab' })]);
  });

  it('offers older drafts for recovery and does not overwrite in-progress edits', async () => {
    writeDraft({ ...draft('older', 1, 'older'), savedAt: 1 });
    writeDraft({ ...draft('server', 1, 'newer'), savedAt: 2 });
    await store().loadNote('meeting-1');
    expect(store().recoveryDrafts).toHaveLength(1);
    const key = store().recoveryDrafts[0].key;
    store().setContent('working');
    store().restoreDraft(key);
    expect(store().noteContent).toBe('working');
    await store().saveNote('meeting-1');
    store().restoreDraft(key);
    await store().loadNote('meeting-1');
    expect(store().noteContent).toBe('older');
  });

  it('surfaces storage failure while keeping the editor usable and saving to the server', async () => {
    await store().loadNote('meeting-1');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    store().setContent('kept in memory');
    expect(store()).toMatchObject({ noteContent: 'kept in memory', backupError: true, isDirty: true });
    expect(await store().saveNote('meeting-1')).toBe(true);
    expect(store().backupError).toBe(false);
  });

  it('preserves over-limit input locally without sending an invalid save', async () => {
    await store().loadNote('meeting-1');
    store().setContent('x'.repeat(100_001));
    expect(await store().saveNote('meeting-1')).toBe(false);
    expect(noteApi.save).not.toHaveBeenCalled();
    expect(readDrafts('meeting-1')[0].content).toHaveLength(100_001);
    store().setContent('valid');
    expect(await store().saveNote('meeting-1')).toBe(true);
  });

  it('retains a storage-failure draft across SPA navigation and guards closure', async () => {
    await store().loadNote('meeting-1');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    store().setContent('memory-only draft');
    vi.mocked(noteApi.save).mockRejectedValueOnce(new Error('offline'));
    await store().saveNote('meeting-1');
    store().clearNote();
    const closing = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);
    await store().loadNote('meeting-1');
    expect(store()).toMatchObject({ noteContent: 'memory-only draft', isDirty: true, backupError: true });
    expect(await store().saveNote('meeting-1')).toBe(true);
    const saved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });
});
