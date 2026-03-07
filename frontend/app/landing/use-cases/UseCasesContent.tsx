'use client';

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { UseCaseComparison } from '@/components/landing/UseCaseComparison';
import { BottomCta } from '@/components/landing/BottomCta';
import { MobileStickyCta } from '@/components/landing/MobileStickyCta';

export function UseCasesContent() {
  return (
    <div className="landing-shell min-h-dvh">
      <LandingNav />
      <main className="pt-20">
        <UseCaseComparison />
        <div className="landing-section-divider" />
        <BottomCta />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}
