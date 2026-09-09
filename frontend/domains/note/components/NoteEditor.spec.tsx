// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteApi } from '../api/noteApi';
import { useNoteStore } from '../stores/noteStore';
import { NoteEditor } from './NoteEditor';

vi.mock('../api/noteApi', () => ({ noteApi: { get: vi.fn(), save: vi.fn() } }));
vi.mock('@/components/editor/MarkdownWysiwygEditor', () => ({
  MarkdownWysiwygEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="노트 내용" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
const server = { id: 'note-1', meetingId: 'meeting-1', content: '원본', revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

describe('note editor recovery controls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    useNoteStore.getState().clearNote();
    vi.mocked(noteApi.get).mockResolvedValue(server);
    vi.mocked(noteApi.save).mockImplementation(async (_id, content, revision) => ({ ...server, content, revision: revision + 1 }));
  });
  afterEach(async () => { cleanup(); await act(async () => {}); });

  it('blocks editing after a load failure and offers a working retry', async () => {
    vi.mocked(noteApi.get).mockRejectedValueOnce(new Error('일시적인 오류'));
    render(<NoteEditor meetingId="meeting-1" />);
    await screen.findByText('노트를 불러오지 못했습니다');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByRole('textbox')).toHaveValue('원본');
  });

  it('shows dirty state immediately and saves with Ctrl+S', async () => {
    render(<NoteEditor meetingId="meeting-1" />);
    const editor = await screen.findByRole('textbox');
    fireEvent.change(editor, { target: { value: '새 메모' } });
    expect(screen.getByText('저장 대기 중')).toBeInTheDocument();
    expect(screen.getByText(/기기에 초안 보관됨/)).toBeInTheDocument();
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
    await waitFor(() => expect(noteApi.save).toHaveBeenCalledWith('meeting-1', '새 메모', 1));
    await waitFor(() => expect(screen.getByRole('button', { name: '지금 저장' })).toBeDisabled());
  });

  it('lets the user inspect a conflict, merge text, and save against the latest revision', async () => {
    render(<NoteEditor meetingId="meeting-1" />);
    const editor = await screen.findByRole('textbox');
    fireEvent.change(editor, { target: { value: '내 수정' } });
    vi.mocked(noteApi.save).mockRejectedValueOnce(Object.assign(new Error('conflict'), { statusCode: 409 }));
    vi.mocked(noteApi.get).mockResolvedValue({ ...server, content: '다른 탭 수정', revision: 2 });
    fireEvent.click(screen.getByRole('button', { name: '지금 저장' }));
    await screen.findByText('동시 편집 충돌');
    expect(editor).toHaveValue('내 수정');
    expect(screen.getByText('다른 탭 수정')).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: '두 수정 합침' } });
    fireEvent.click(screen.getByRole('button', { name: '현재 내용으로 저장' }));
    await waitFor(() => expect(noteApi.save).toHaveBeenLastCalledWith('meeting-1', '두 수정 합침', 2));
    await waitFor(() => expect(screen.queryByText('동시 편집 충돌')).not.toBeInTheDocument());
  });
});
