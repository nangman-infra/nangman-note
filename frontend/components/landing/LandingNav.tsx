'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowRight, Menu, X, Sparkles } from 'lucide-react';

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
        scrolled ? 'border-b border-[var(--line-soft)] bg-white/90 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      {/* 데스크톱 */}
      <div className="mx-auto hidden h-[62px] max-w-[1200px] items-center gap-2 px-6 sm:flex lg:px-8">
        <Link href="/landing" className="mr-4 inline-flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand" aria-hidden="true">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </span>
          <span className="font-headline text-[15px] text-brand">TransNote</span>
        </Link>

        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              pathname === link.href
                ? 'border-[var(--line-soft)] bg-white/60 font-medium text-[var(--ink-strong)] backdrop-blur'
                : 'border-transparent font-normal text-[var(--ink-subtle)] hover:border-[var(--line-soft)] hover:bg-white/60 hover:text-[var(--ink-strong)]'
            }`}
          >
            {link.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Link href="/auth/signin" className="btn-neo inline-flex !py-2 text-sm">
            로그인
          </Link>
          <Link href="/landing/start" className="btn-primary inline-flex !py-2">
            무료로 시작하기
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      {/* 모바일 */}
      <div className="flex items-center justify-between px-5 py-3.5 sm:hidden">
        <Link href="/landing" className="inline-flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand" aria-hidden="true">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </span>
          <span className="font-headline text-[15px] text-brand">TransNote</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="btn-neo inline-flex !p-2"
          aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {mobileOpen && (
        <div className="surface-card mx-4 mb-2 p-3 sm:hidden">
          <div className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-[var(--ink-subtle)] transition hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)]"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--line-soft)] pt-3">
              <Link href="/auth/signin" onClick={() => setMobileOpen(false)} className="btn-neo inline-flex">
                로그인
              </Link>
              <Link href="/landing/start" onClick={() => setMobileOpen(false)} className="btn-primary inline-flex">
                시작하기
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
