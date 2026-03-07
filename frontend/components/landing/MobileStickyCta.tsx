'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] p-3 sm:hidden" style={{ background: 'rgba(244, 240, 230, 0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <Link
        href="/landing/start"
        className="btn-neo flex w-full items-center justify-center gap-2 border-transparent bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-strong hover:text-white"
      >
        무료로 시작하기
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
