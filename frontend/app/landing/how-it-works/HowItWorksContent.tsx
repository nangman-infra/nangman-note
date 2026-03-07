'use client';

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { StepFlow } from '@/components/landing/StepFlow';
import { BottomCta } from '@/components/landing/BottomCta';
import { MobileStickyCta } from '@/components/landing/MobileStickyCta';

export function HowItWorksContent() {
  return (
    <div className="landing-shell min-h-dvh">
      <LandingNav />
      <main className="pt-20">
        <StepFlow />
        <div className="landing-section-divider" />
        <BottomCta nextHref="/landing/use-cases" nextLabel="실제 사례 보기" />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}
