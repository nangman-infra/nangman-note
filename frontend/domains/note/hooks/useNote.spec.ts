// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteApi } from '../api/noteApi';
import { useNoteStore } from '../stores/noteStore';
import { useNote } from './useNote';
import { AUTO_SAVE_DELAY } from '@/lib/constants';

vi.mock('../api/noteApi', () => ({ noteApi: { get: vi.fn(), save: vi.fn() } }));
const server = { id: 'note-1', meetingId: 'meeting-1', content: 'original', revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const tick = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('note autosave lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    localStorage.clear();
    useNoteStore.getState().clearNote();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(noteApi.get).mockResolvedValue(server);
    vi.mocked(noteApi.save).mockImplementation(async (_id, content, revision) => ({ ...server, content, revision: revision + 1 }));
  });
  afterEach(async () => {
    cleanup();
    await tick();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('autosaves an empty edit after debounce, but never saves the initial read', async () => {
    const { result } = renderHook(() => useNote('meeting-1'));
    await tick(3_000);
    expect(noteApi.save).not.toHaveBeenCalled();
    act(() => result.current.setContent(''));
    await tick(3_000);
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', '', 1);
    expect(result.current.isDirty).toBe(false);
  });

  it('autosaves a restored empty draft without waiting for another keystroke', async () => {
    localStorage.setItem('transnote_offline_note_meeting-1', JSON.stringify({ content: '', baseRevision: 1, savedAt: Date.now() }));
    renderHook(() => useNote('meeting-1'));
    await tick(3_000);
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', '', 1);
  });

  it('retries transient failures with backoff without further typing', async () => {
    const { result } = renderHook(() => useNote('meeting-1'));
    await tick();
    vi.mocked(noteApi.save).mockRejectedValueOnce(new Error('network failure'));
    act(() => result.current.setContent('draft'));
    await tick(AUTO_SAVE_DELAY);
    expect(noteApi.save).toHaveBeenCalledTimes(1);
    await tick(2_000);
    expect(noteApi.save).toHaveBeenCalledTimes(2);
    expect(result.current.isDirty).toBe(false);
  });

  it('retries on reconnection and does not save while offline', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get');
    const { result } = renderHook(() => useNote('meeting-1'));
    await tick();
    online.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event('offline')); result.current.setContent('offline draft'); });
    await tick(10_000);
    expect(noteApi.save).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    await tick();
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', 'offline draft', 1);
  });

  it('does not continuously retry permission failures', async () => {
    const { result } = renderHook(() => useNote('meeting-1'));
    await tick();
    vi.mocked(noteApi.save).mockRejectedValue(Object.assign(new Error('forbidden'), { statusCode: 403 }));
    act(() => result.current.setContent('draft'));
    await tick(60_000);
    expect(noteApi.save).toHaveBeenCalledTimes(1);
  });

  it('flushes pending edits on unmount and isolates the next meeting', async () => {
    const { result, rerender, unmount } = renderHook(({ id }) => useNote(id), { initialProps: { id: 'meeting-1' } });
    await tick();
    act(() => result.current.setContent('last keystroke'));
    vi.mocked(noteApi.get).mockResolvedValue({ ...server, meetingId: 'meeting-2', content: 'second' });
    rerender({ id: 'meeting-2' });
    await tick();
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', 'last keystroke', 1);
    expect(result.current.noteContent).toBe('second');
    act(() => result.current.setContent('second edit'));
    unmount();
    await tick();
    expect(noteApi.save).toHaveBeenLastCalledWith('meeting-2', 'second edit', 1);
  });

  it('guards tab closure while unsaved and removes the guard after save', async () => {
    const { result } = renderHook(() => useNote('meeting-1'));
    await tick();
    act(() => result.current.setContent('draft'));
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    await tick(3_000);
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
