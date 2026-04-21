import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

export type LegalDocumentSection = {
  id: string;
  title: string;
  children: ReactNode;
};

type LegalDocumentLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalDocumentSection[];
};

export function LegalDocumentLayout({
  eyebrow,
  title,
  description,
  effectiveDate,
  sections,
}: LegalDocumentLayoutProps) {
  return (
    <main className="min-h-dvh bg-[var(--bg-root)] px-5 py-8 text-[var(--ink-strong)] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--brand)] shadow-sm transition hover:bg-[var(--surface-container-low)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            로그인으로 돌아가기
          </Link>

          <Link
            href="/landing"
            className="font-headline text-sm font-extrabold tracking-tight text-indigo-700"
          >
            TransNote
          </Link>
        </nav>

        <header className="rounded-2xl bg-white px-6 py-8 shadow-xl sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="label-sm text-[var(--brand)]">{eyebrow}</p>
              <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-[var(--ink-strong)] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-subtle)]">
                {description}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
              <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                시행일
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--ink-strong)]">
                {effectiveDate}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          <aside className="rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--ink-strong)]">
              <FileText className="h-4 w-4 text-[var(--brand)]" />
              문서 목차
            </div>
            <ol className="mt-4 space-y-1">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)]"
                  >
                    <span className="font-mono text-[10px] text-[var(--brand)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <article className="rounded-2xl bg-white px-6 py-7 shadow-sm sm:px-8 lg:px-10">
            <div className="mb-8 flex items-start gap-3 rounded-2xl bg-indigo-50 px-4 py-4 text-sm leading-7 text-indigo-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-700" />
              <p>
                본 문서는 TransNote의 실제 로그인 방식과 회의 기록 워크플로우를
                기준으로 작성한 운영 문서입니다. 법령이나 서비스 운영 방식이
                바뀌면 문서도 함께 갱신됩니다.
              </p>
            </div>

            <div className="space-y-10">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-8 border-t border-[var(--line-soft)] pt-8 first:border-t-0 first:pt-0"
                >
                  <h2 className="font-headline text-xl font-extrabold tracking-tight text-[var(--ink-strong)]">
                    {section.title}
                  </h2>
                  <div className="legal-copy mt-4 space-y-4 text-sm leading-8 text-[var(--ink-subtle)]">
                    {section.children}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
