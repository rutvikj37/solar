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
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return undefined;
    const timer = window.setTimeout(() => {
      if (hash === 'lead-form') {
        scrollToLeadForm();
        return;
      }
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
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
