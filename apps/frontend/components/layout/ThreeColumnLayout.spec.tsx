// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { ThreeColumnLayout } from './ThreeColumnLayout';

function StatefulViewer() {
  const [draft, setDraft] = useState('');

  return (
    <label>
      초안
      <input
        aria-label="viewer-draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}

describe('ThreeColumnLayout', () => {
  it('preserves compact viewer draft state when switching to sidebar and back', () => {
    render(
      <ThreeColumnLayout
        sidebar={<div>sidebar</div>}
        list={<div>list</div>}
        viewer={<StatefulViewer />}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '문서' }));

    const compactViewerInput = screen.getAllByLabelText('viewer-draft')[0];
    fireEvent.change(compactViewerInput, { target: { value: '임시 초안' } });

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '문서' }));

    expect(
      (screen.getAllByLabelText('viewer-draft')[0] as HTMLInputElement).value,
    ).toBe('임시 초안');
  });
});
