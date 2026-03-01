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
    useNoteStore.setState({
      noteContent: '',
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
