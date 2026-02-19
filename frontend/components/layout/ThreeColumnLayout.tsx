'use client';

import { useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ThreeColumnLayoutProps {
  sidebar: React.ReactNode;
  list: React.ReactNode;
  viewer: React.ReactNode;
}

export function ThreeColumnLayout({ sidebar, list, viewer }: ThreeColumnLayoutProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeColumn, setActiveColumn] = useState<'list' | 'viewer'>('list');

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col">
        {activeColumn === 'list' ? list : viewer}
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <aside className="w-60 border-r bg-gray-50">{sidebar}</aside>
      <div className="w-80 border-r">{list}</div>
      <main className="flex-1">{viewer}</main>
    </div>
  );
}
