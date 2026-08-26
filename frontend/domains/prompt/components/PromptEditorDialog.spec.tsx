// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PromptEditorDialog } from './PromptEditorDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('PromptEditorDialog', () => {
  it('resets create and edit drafts each time it opens', () => {
    const props = {
      open: true,
      mode: 'create' as const,
      onSave: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(<PromptEditorDialog {...props} />);
    const nameInput = screen.getByLabelText('프롬프트 이름');
    fireEvent.change(nameInput, { target: { value: 'unsaved create draft' } });

    rerender(<PromptEditorDialog {...props} open={false} />);
    rerender(<PromptEditorDialog {...props} open />);
    expect((screen.getByLabelText('프롬프트 이름') as HTMLInputElement).value).toBe('');

    rerender(
      <PromptEditorDialog
        {...props}
        mode="edit"
        initialName="saved prompt"
        initialContent="saved content"
      />,
    );
    expect((screen.getByLabelText('프롬프트 이름') as HTMLInputElement).value).toBe(
      'saved prompt',
    );
    expect((screen.getByLabelText('추가 강조 지시') as HTMLTextAreaElement).value).toBe(
      'saved content',
    );
  });
});
