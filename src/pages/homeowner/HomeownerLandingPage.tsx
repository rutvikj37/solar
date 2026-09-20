import { lazy, Suspense, useEffect } from 'react';
import { SolarHero } from '@/components/homeowner/SolarHero';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';
import { scrollToLeadForm } from '@/lib/scrollToLeadForm.js';

const HowItWorks = lazy(() =>
  import('@/components/homeowner/HowItWorks').then((m) => ({ default: m.HowItWorks }))
);
const FAQ = lazy(() =>
  import('@/components/homeowner/FAQ').then((m) => ({ default: m.FAQ }))
);
const LeadForm = lazy(() =>
  import('@/components/homeowner/LeadForm/LeadForm').then((m) => ({ default: m.LeadForm }))
);
const Footer = lazy(() =>
  import('@/components/homeowner/Footer').then((m) => ({ default: m.Footer }))
);

function BelowFoldFallback() {
  return <div className="min-h-[40vh] bg-navy-dark" aria-hidden="true" />;
}

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
        <Suspense fallback={<BelowFoldFallback />}>
          <HowItWorks />
          <FAQ />
          <LeadForm />
          <Footer />
        </Suspense>
      </main>
    </HomeownerShell>
  );
}
