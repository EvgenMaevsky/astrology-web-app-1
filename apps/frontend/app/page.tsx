import { FinalCta } from "@/app/_components/landing/FinalCta";
import { Footer } from "@/app/_components/landing/Footer";
import { Hero } from "@/app/_components/landing/Hero";
import { HowItWorks } from "@/app/_components/landing/HowItWorks";
import { LiveChart } from "@/app/_components/landing/LiveChart";
import { Pricing } from "@/app/_components/landing/Pricing";
import { SiteHeader } from "@/app/_components/site-header/SiteHeader";
import { ProFeatures } from "@/app/_components/landing/ProFeatures";
import { Techniques } from "@/app/_components/landing/Techniques";
import { TrustStats } from "@/app/_components/landing/TrustStats";

// The nine sections of docs/plans/2026-09-24-e7-redesign-design.md §4, in
// order. Each lives in its own file under _components/landing.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-space-950">
      <SiteHeader />
      <Hero />
      <TrustStats />
      <LiveChart />
      <Techniques />
      <ProFeatures />
      <HowItWorks />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}
