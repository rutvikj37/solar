import { Navbar } from '@/components/homeowner/Navbar';
import { AboutPage } from '@/components/homeowner/AboutPage';
import { Footer } from '@/components/homeowner/Footer';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';

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
