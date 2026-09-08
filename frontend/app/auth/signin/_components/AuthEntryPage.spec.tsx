// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { signIn } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEntryPage } from './AuthEntryPage';

const replaceMock = vi.fn();
let sessionStatus: 'authenticated' | 'unauthenticated' | 'loading' =
  'unauthenticated';
let sessionData: {
  accessToken?: string;
  error?: 'RefreshAccessTokenError';
} | null = null;
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
  useSession: () => ({ status: sessionStatus, data: sessionData }),
}));

function authenticate(overrides: Partial<NonNullable<typeof sessionData>> = {}) {
  sessionStatus = 'authenticated';
  sessionData = { accessToken: 'access-token', ...overrides };
}

describe('AuthEntryPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    vi.mocked(signIn).mockClear();
    sessionStatus = 'unauthenticated';
    sessionData = null;
    searchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders only the configured Authentik sign-in action', () => {
    render(<AuthEntryPage mode="signin" />);

    const ssoButton = screen.getByRole('button', {
      name: /낭만 계정으로 로그인/,
    });
    expect(ssoButton).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /이메일/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/매직 링크/)).not.toBeInTheDocument();

    fireEvent.click(ssoButton);
    expect(signIn).toHaveBeenCalledWith('authentik', { callbackUrl: '/' });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('replaces to "/" when already authenticated (no callbackUrl)', () => {
    authenticate();

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('replaces to the callbackUrl when already authenticated', () => {
    authenticate();
    searchParams = new URLSearchParams('callbackUrl=%2Fsettings');

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/settings');
  });

  it('hides the sign-in form while redirecting an authenticated visitor', () => {
    authenticate();

    render(<AuthEntryPage mode="signin" />);

    expect(
      screen.queryByRole('button', { name: /낭만 계정으로 로그인/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps the sign-in form when the session exists but has no access token (broken session)', () => {
    authenticate({ accessToken: undefined, error: 'RefreshAccessTokenError' });

    render(<AuthEntryPage mode="signin" />);

    expect(
      screen.getByRole('button', { name: /낭만 계정으로 로그인/ }),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('normalizes external callbackUrl to "/"', () => {
    authenticate();
    searchParams = new URLSearchParams('callbackUrl=https%3A%2F%2Fevil.example%2Fphish');

    render(<AuthEntryPage mode="signin" />);

    expect(replaceMock).toHaveBeenCalledWith('/');
  });
});
