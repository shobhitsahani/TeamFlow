"use client";

import AetherFlowHero from "@/components/ui/aether-flow-hero";
import { LandingBoardSection } from "@/components/landing/LandingBoardSection";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import LandingFooter from "@/components/landing/LandingFooter";
import { TenantIsolationSection } from "@/components/landing/TenantIsolationSection";
import styles from "@/components/landing/landing.module.css";

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-black flex flex-col justify-between">
      <a href="#product" className={styles.skipLink}>
        Skip to content
      </a>
      <AetherFlowHero />
      <LandingBoardSection />
      <TenantIsolationSection />
      <LandingFeatures />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
