// @vitest-environment jsdom

/**
 * URL/history sync for the home workspace.
 *
 * The URL is the source of truth on '/':
 *   ?view=history|prompts|settings (absent = dashboard)
 *   ?view=trash                    (history view with trash open)
 *   ?meeting=<id>                  (selected meeting viewer)
 *
 * These tests mock next/navigation and verify that user-initiated changes
 * push history entries, that state is derived from searchParams (so browser
 * Back — a searchParams change — restores the previous view), and that deep
 * links render the meeting viewer.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePageContent } from './HomePageContent';

const { back, navState, push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  navState: { params: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
    back,
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => navState.params,
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}));

vi.mock('@/domains/meeting', () => ({
  meetingApi: { update: vi.fn() },
  useMeetingStore: { setState: vi.fn() },
}));

vi.mock('@/domains/prompt', () => ({
  usePrompt: () => ({ prompts: [] }),
  formatPromptLabel: (prompt: { name: string }) => prompt.name,
}));

vi.mock('@/domains/result', () => ({
  ResultViewer: ({
    meetingId,
    onMeetingUnavailable,
  }: {
    meetingId: string;
    onMeetingUnavailable?: () => void;
  }) => (
    <div data-testid="result-viewer">
      viewer:{meetingId}
      <button type="button" onClick={() => onMeetingUnavailable?.()}>
        meeting-unavailable
      </button>
    </div>
  ),
  useResultStore: { setState: vi.fn() },
}));

vi.mock('./DashboardView', () => ({
  DashboardView: ({
    onSelectMeeting,
  }: {
    onSelectMeeting: (id: string | null) => void;
  }) => (
    <div data-testid="dashboard-view">
      <button type="button" onClick={() => onSelectMeeting('m-1')}>
        select-meeting
      </button>
    </div>
  ),
}));

vi.mock('./PromptsInlineView', () => ({
  PromptsInlineView: () => <div data-testid="prompts-inline" />,
}));

vi.mock('./SettingsInlineView', () => ({
  SettingsInlineView: () => <div data-testid="settings-inline" />,
}));

function setSearchParams(query: string) {
  navState.params = new URLSearchParams(query);
}

beforeEach(() => {
  setSearchParams('');
});

afterEach(() => {
  cleanup();
});

describe('HomePageContent URL/history sync', () => {
  it('pushes ?view=<view> when the user changes the view', () => {
    render(<HomePageContent />);

    fireEvent.click(screen.getAllByRole('button', { name: '회의 기록' })[0]);
    expect(push).toHaveBeenCalledWith('/?view=history');

    fireEvent.click(screen.getAllByRole('button', { name: '설정' })[0]);
    expect(push).toHaveBeenCalledWith('/?view=settings');

    expect(replace).not.toHaveBeenCalled();
  });

  it('pushes ?meeting=<id> when a meeting is selected, preserving the view param', () => {
    render(<HomePageContent />);

    fireEvent.click(screen.getAllByRole('button', { name: 'select-meeting' })[0]);
    expect(push).toHaveBeenCalledWith('/?meeting=m-1');
  });

  it('keeps ?view=history when selecting a meeting from the history view', () => {
    setSearchParams('view=history');
    render(<HomePageContent />);

    fireEvent.click(screen.getAllByRole('button', { name: 'select-meeting' })[0]);
    expect(push).toHaveBeenCalledWith('/?view=history&meeting=m-1');
  });

  it('restores the dashboard when searchParams change back (browser Back)', () => {
    setSearchParams('view=prompts');
    const { rerender } = render(<HomePageContent />);
    expect(screen.getAllByTestId('prompts-inline').length).toBeGreaterThan(0);

    // Browser Back: Next re-renders with the previous searchParams.
    setSearchParams('');
    rerender(<HomePageContent />);

    expect(screen.queryByTestId('prompts-inline')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-view').length).toBeGreaterThan(0);
  });

  it('closes the meeting viewer when searchParams drop ?meeting (browser Back)', () => {
    setSearchParams('meeting=m-1');
    const { rerender } = render(<HomePageContent />);
    expect(screen.getAllByTestId('result-viewer')[0]).toHaveTextContent('viewer:m-1');

    setSearchParams('');
    rerender(<HomePageContent />);
    expect(screen.queryByTestId('result-viewer')).not.toBeInTheDocument();
  });

  it('renders the viewer for a deep link with view and meeting params', () => {
    setSearchParams('view=history&meeting=m-42');
    render(<HomePageContent />);

    expect(screen.getAllByTestId('result-viewer')[0]).toHaveTextContent(
      'viewer:m-42',
    );
  });

  it('replaces (not pushes) the URL when the selection is cleared programmatically', () => {
    setSearchParams('view=history&meeting=m-42');
    render(<HomePageContent />);

    // e.g. the meeting was deleted → ResultViewer reports it unavailable.
    fireEvent.click(
      screen.getAllByRole('button', { name: 'meeting-unavailable' })[0],
    );

    expect(replace).toHaveBeenCalledWith('/?view=history');
    expect(push).not.toHaveBeenCalled();
  });
});
