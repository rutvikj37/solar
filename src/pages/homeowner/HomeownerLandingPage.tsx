import { SolarHero } from '@/components/homeowner/SolarHero';
import { HowItWorks } from '@/components/homeowner/HowItWorks';
import { FAQ } from '@/components/homeowner/FAQ';
import { LeadForm } from '@/components/homeowner/LeadForm/LeadForm';
import { Footer } from '@/components/homeowner/Footer';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';

export default function HomeownerLandingPage() {
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
