// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ResultExportMenu } from './ResultExportMenu';
import { ResultTabNav } from './ResultTabNav';
import type { ResultTab } from './resultViewerTypes';

function StatefulTabs() {
  const [activeTab, setActiveTab] = useState<ResultTab>('result');
  return <ResultTabNav activeTab={activeTab} onTabChange={setActiveTab} />;
}

describe('result keyboard accessibility', () => {
  it('exposes tabs and moves selection with arrow keys', () => {
    render(<StatefulTabs />);

    const summaryTab = screen.getByRole('tab', { name: 'AI 회의록' });
    const transcriptTab = screen.getByRole('tab', { name: '전체 전사' });
    summaryTab.focus();
    fireEvent.keyDown(summaryTab, { key: 'ArrowRight' });

    expect(transcriptTab).toHaveFocus();
    expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
    expect(summaryTab).toHaveAttribute('tabindex', '-1');
  });

  it('opens the export menu from the keyboard and restores trigger focus on Escape', () => {
    render(
      <ResultExportMenu
        isExporting={null}
        onExportPDF={vi.fn()}
        onExportDOCX={vi.fn()}
        onExportMD={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: '내보내기' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const firstItem = screen.getByRole('menuitem', { name: 'PDF 내보내기' });
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(firstItem, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Markdown 내보내기' })).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
