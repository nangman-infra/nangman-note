// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNote } from './useNote';

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

const useNoteStoreMock = vi.hoisted(() => vi.fn());

vi.mock('../stores/noteStore', () => ({
  useNoteStore: useNoteStoreMock,
}));

describe('useNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-saves when content changes to empty string', async () => {
    let noteContent = '기존 텍스트';
    const saveNote = vi.fn().mockResolvedValue(true);
    const loadNote = vi.fn().mockResolvedValue('기존 텍스트');
    const setContent = vi.fn((value: string) => {
      noteContent = value;
    });

    useNoteStoreMock.mockImplementation(() => ({
      noteContent,
      isSaving: false,
      lastSaved: null,
      error: null,
      setContent,
      saveNote,
      loadNote,
      clearNote: vi.fn(),
    }));

    const { rerender } = renderHook(() => useNote('meeting-1'));

    await waitFor(() => {
      expect(loadNote).toHaveBeenCalledWith('meeting-1');
    });

    act(() => {
      noteContent = '';
      rerender();
    });

    await waitFor(() => {
      expect(saveNote).toHaveBeenCalledWith('meeting-1');
    });
  });

  it('does not load or auto-save when meetingId is empty', async () => {
    const saveNote = vi.fn().mockResolvedValue(true);
    const loadNote = vi.fn().mockResolvedValue('동일 텍스트');

    useNoteStoreMock.mockReturnValue({
      noteContent: '동일 텍스트',
      isSaving: false,
      lastSaved: null,
      error: null,
      setContent: vi.fn(),
      saveNote,
      loadNote,
      clearNote: vi.fn(),
    });

    renderHook(() => useNote(''));

    expect(loadNote).not.toHaveBeenCalled();
    expect(saveNote).not.toHaveBeenCalled();
  });
});
