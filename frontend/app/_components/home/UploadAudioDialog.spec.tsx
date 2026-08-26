// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UploadAudioDialog } from './UploadAudioDialog';

vi.mock('@/components/feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ pushToast: vi.fn() }),
}));

vi.mock('@/domains/meeting', () => ({
  meetingApi: { delete: vi.fn() },
  MeetingTranscriptionMode: { BATCH: 'batch' },
}));

vi.mock('@/domains/transcription', () => ({
  transcriptionApi: {},
}));

describe('UploadAudioDialog', () => {
  it('traps focus, closes with Escape, and restores trigger focus', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>업로드 열기</button>
          <UploadAudioDialog open={open} onClose={() => setOpen(false)} onUploaded={vi.fn()} />
        </>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '업로드 열기' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '오디오 파일 업로드' });
    const closeButton = screen.getByRole('button', { name: '닫기' });
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('textbox', { name: '회의 제목' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
