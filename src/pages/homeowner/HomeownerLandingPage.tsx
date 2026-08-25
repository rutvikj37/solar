import { useEffect } from 'react';
import { SolarHero } from '@/components/homeowner/SolarHero';
import { HowItWorks } from '@/components/homeowner/HowItWorks';
import { FAQ } from '@/components/homeowner/FAQ';
import { LeadForm } from '@/components/homeowner/LeadForm/LeadForm';
import { Footer } from '@/components/homeowner/Footer';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';
import { scrollToLeadForm } from '@/lib/scrollToLeadForm.js';

export default function HomeownerLandingPage() {
  useEffect(() => {
    if (window.location.hash.replace(/^#/, '') === 'lead-form') {
      const timer = window.setTimeout(() => scrollToLeadForm(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);
  return (
    <HomeownerShell>
      <main className="bg-navy-dark">
        <SolarHero />
        <HowItWorks />
        <FAQ />
        <LeadForm />
        <Footer />
      </main>
    </HomeownerShell>
  );
}
