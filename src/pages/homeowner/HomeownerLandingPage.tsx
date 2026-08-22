import { SolarHero } from '@/components/solar/SolarHero';
import { HowItWorks } from '@/components/solar/HowItWorks';
import { FAQ } from '@/components/solar/FAQ';
import { LeadForm } from '@/components/solar/LeadForm/LeadForm';
import { Footer } from '@/components/solar/Footer';
import { HomeownerShell } from '@/homeowner/HomeownerShell';

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
