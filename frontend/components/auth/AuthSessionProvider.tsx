'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { setAccessToken } from '@/lib/auth/access-token-store';

function SessionTokenSync() {
  const { data } = useSession();

  useEffect(() => {
    setAccessToken(data?.accessToken);
  }, [data?.accessToken]);

  return null;
}

interface AuthSessionProviderProps {
  children: React.ReactNode;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider>
      <SessionTokenSync />
      {children}
    </SessionProvider>
  );
}

