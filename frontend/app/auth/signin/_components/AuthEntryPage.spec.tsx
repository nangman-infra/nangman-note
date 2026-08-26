// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEntryPage } from './AuthEntryPage';

const replaceMock = vi.fn();
let sessionStatus: 'authenticated' | 'unauthenticated' | 'loading' =
  'unauthenticated';
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: () => ({ status: sessionStatus, data: null }),
}));

describe('AuthEntryPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    sessionStatus = 'unauthenticated';
    searchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the sign-in form when unauthenticated and does not redirect', () => {
    render(<AuthEntryPage mode="signin" />);

    expect(
      screen.getByRole('button', { name: /낭만 계정으로 로그인/ }),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('replaces to "/" when already authenticated (no callbackUrl)', () => {
    sessionStatus = 'authenticated';

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('replaces to the callbackUrl when already authenticated', () => {
    sessionStatus = 'authenticated';
    searchParams = new URLSearchParams('callbackUrl=%2Fsettings');

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/settings');
  });

  it('hides the sign-in form while redirecting an authenticated visitor', () => {
    sessionStatus = 'authenticated';

    render(<AuthEntryPage mode="signin" />);

    expect(
      screen.queryByRole('button', { name: /낭만 계정으로 로그인/ }),
    ).not.toBeInTheDocument();
  });

  it('normalizes external callbackUrl to "/"', () => {
    sessionStatus = 'authenticated';
    searchParams = new URLSearchParams('callbackUrl=https%3A%2F%2Fevil.example%2Fphish');

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/');
  });
});
