'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';

const navLinks = [
  { href: '/landing/guide', label: '사용 가이드' },
  { href: '/landing/how-it-works', label: '동작 방식' },
  { href: '/landing/use-cases', label: '사례' },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-[var(--line-soft)]' : ''
      }`}
      style={
        scrolled
          ? {
              // Use the globals `--bg-elevated` token (frosted surface) rather
              // than a hardcoded cream value, per NFR-4.
              background: 'var(--bg-elevated)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }
          : undefined
      }
    >
      {/* 데스크톱 */}
      <div className="mx-auto hidden max-w-6xl items-center gap-6 px-5 py-3.5 sm:flex">
        <Link href="/landing" className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] bg-white/80 px-2.5 py-1 font-headline text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            TransNote
          </span>
        </Link>

        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/60 hover:text-foreground ${
              pathname === link.href ? 'text-brand' : 'text-muted'
            }`}
          >
            {link.label}
          </Link>
        ))}

        <Link
          href="/landing/start"
          className="btn-neo inline-flex ml-auto border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white"
        >
          무료로 시작하기
        </Link>
      </div>

      {/* 모바일 */}
      <div className="flex items-center justify-between px-5 py-3.5 sm:hidden">
        <Link href="/landing" className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] bg-white/80 px-2.5 py-1 font-headline text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            TransNote
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl border border-[var(--line-soft)] p-2 text-muted transition hover:border-[var(--line-strong)]"
          aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {mobileOpen && (
        <div className="glass-surface mx-4 mb-2 rounded-2xl p-4 sm:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-white/60"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/landing/start"
              onClick={() => setMobileOpen(false)}
              className="btn-neo inline-flex mt-2 border-transparent bg-brand text-center text-white hover:bg-brand-strong hover:text-white"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
