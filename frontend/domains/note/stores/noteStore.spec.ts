// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noteApi } from '../api/noteApi';
import { useNoteStore } from './noteStore';

vi.mock('../api/noteApi', () => ({
  noteApi: {
    save: vi.fn(),
    get: vi.fn(),
  },
}));

describe('useNoteStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useNoteStore.setState({
      noteContent: '',
      isDirty: false,
      isSaving: false,
      lastSaved: null,
      error: null,
    });
  });

  it('saves empty note content successfully', async () => {
    vi.mocked(noteApi.save).mockResolvedValue({ id: 'note-1', meetingId: 'meeting-1', content: '', createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });
    useNoteStore.getState().setContent('');

    const success = await useNoteStore.getState().saveNote('meeting-1');

    expect(success).toBe(true);
    expect(noteApi.save).toHaveBeenCalledWith('meeting-1', '');
    expect(useNoteStore.getState().lastSaved).not.toBeNull();
    expect(useNoteStore.getState().error).toBeNull();
  });

  it('keeps newer edits dirty when an older save finishes', async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof noteApi.save>>) => void;
    vi.mocked(noteApi.save).mockImplementation(
      () => new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    useNoteStore.getState().setContent('first draft');

    const saving = useNoteStore.getState().saveNote('meeting-1');
    await Promise.resolve();
    useNoteStore.getState().setContent('newer draft');
    resolveSave({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: 'first draft',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    await saving;

    expect(useNoteStore.getState().noteContent).toBe('newer draft');
    expect(useNoteStore.getState().isDirty).toBe(true);
    expect(useNoteStore.getState().isSaving).toBe(false);
  });

  it('serializes concurrent saves and only clears backup for the latest revision', async () => {
    let resolveFirst!: (value: Awaited<ReturnType<typeof noteApi.save>>) => void;
    vi.mocked(noteApi.save)
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: 'newer draft',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      });
    localStorage.setItem('transnote_offline_note_meeting-1', 'backup');
    useNoteStore.getState().setContent('first draft');
    const firstSave = useNoteStore.getState().saveNote('meeting-1');
    await Promise.resolve();
    useNoteStore.getState().setContent('newer draft');
    const secondSave = useNoteStore.getState().saveNote('meeting-1');

    expect(noteApi.save).toHaveBeenCalledTimes(1);
    resolveFirst({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: 'first draft',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    await firstSave;
    expect(localStorage.getItem('transnote_offline_note_meeting-1')).toBe('backup');
    await secondSave;

    expect(noteApi.save).toHaveBeenNthCalledWith(1, 'meeting-1', 'first draft');
    expect(noteApi.save).toHaveBeenNthCalledWith(2, 'meeting-1', 'newer draft');
    expect(localStorage.getItem('transnote_offline_note_meeting-1')).toBeNull();
    expect(useNoteStore.getState().isDirty).toBe(false);
  });

  it('loads note content into store and returns content', async () => {
    vi.mocked(noteApi.get).mockResolvedValue({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: '로드된 노트',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const loaded = await useNoteStore.getState().loadNote('meeting-1');

    expect(loaded).toBe('로드된 노트');
    expect(useNoteStore.getState().noteContent).toBe('로드된 노트');
  });

  it('does not overwrite text entered while a note load is pending', async () => {
    let resolveGet: (value: Awaited<ReturnType<typeof noteApi.get>>) => void;
    vi.mocked(noteApi.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );

    const loading = useNoteStore.getState().loadNote('meeting-1');
    useNoteStore.getState().setContent('작성 중인 노트');
    resolveGet!({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: '서버 노트',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    await loading;

    expect(useNoteStore.getState().noteContent).toBe('작성 중인 노트');
    expect(useNoteStore.getState().isDirty).toBe(true);
  });

  it('returns false and sets error when save fails', async () => {
    vi.mocked(noteApi.save).mockRejectedValue(new Error('save failed'));
    useNoteStore.getState().setContent('test');

    const success = await useNoteStore.getState().saveNote('meeting-1');

    expect(success).toBe(false);
    expect(useNoteStore.getState().error).toBe('save failed');
    expect(useNoteStore.getState().isSaving).toBe(false);
  });

  it('returns empty string and sets error when load fails', async () => {
    vi.mocked(noteApi.get).mockRejectedValue(new Error('load failed'));

    const loaded = await useNoteStore.getState().loadNote('meeting-1');

    expect(loaded).toBe('');
    expect(useNoteStore.getState().error).toBe('load failed');
  });

  it('clearNote resets content, error, and save timestamp', () => {
    useNoteStore.setState({
      noteContent: '임시 텍스트',
      error: 'some error',
      lastSaved: new Date('2026-03-01T00:00:00.000Z'),
    });

    useNoteStore.getState().clearNote();

    expect(useNoteStore.getState().noteContent).toBe('');
    expect(useNoteStore.getState().error).toBeNull();
    expect(useNoteStore.getState().lastSaved).toBeNull();
  });
});
