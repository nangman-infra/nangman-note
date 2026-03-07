'use client';

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { HeroSection } from '@/components/landing/HeroSection';
import { ValueCards } from '@/components/landing/ValueCards';
import { SocialProof } from '@/components/landing/SocialProof';
import { MobileStickyCta } from '@/components/landing/MobileStickyCta';

export function LandingContent() {
  return (
    <div className="landing-shell min-h-dvh">
      <LandingNav />
      <main>
        <HeroSection />
        <div className="landing-section-divider" />
        <ValueCards />
        <div className="landing-section-divider" />
        <SocialProof />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}
