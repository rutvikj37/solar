import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { Nav } from './Nav';
import { Hero } from './Hero';
import { Journey } from './Journey';
import { NeighborhoodScan } from './NeighborhoodScan';
import { Dashboard } from './Dashboard';
import { WhyUs } from './WhyUs';
import { Partner } from './Partner';
import { Pricing } from './Pricing';
import { FinalCTA, Footer } from './FinalCTA';
import { scrollToMarketingSection } from '@/lib/marketingScroll.js';
import './styles.css';

export default function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return undefined;
    const timer = window.setTimeout(() => scrollToMarketingSection(hash), 150);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="marketing-root dark">
      <Toaster theme="dark" position="top-center" />
      <main className="relative">
        <Nav />
        <Hero />
        <Journey />
        <NeighborhoodScan />
        <Dashboard />
        <WhyUs />
        <Partner />
        <Pricing />
        <FinalCTA />
        <Footer />
      </main>
    </div>
  );
}
