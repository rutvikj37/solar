import { Navbar } from '@/components/solar/Navbar';
import { AboutPage } from '@/components/solar/AboutPage';
import { Footer } from '@/components/solar/Footer';
import { HomeownerShell } from '@/homeowner/HomeownerShell';

export default function HomeownerAboutPage() {
  return (
    <HomeownerShell>
      <main className="bg-navy-dark min-h-screen">
        <Navbar />
        <AboutPage />
        <Footer />
      </main>
    </HomeownerShell>
  );
}
