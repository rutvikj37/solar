import { Navbar } from '@/components/solar/Navbar';
import { ContactPage } from '@/components/solar/ContactPage';
import { Footer } from '@/components/solar/Footer';
import { HomeownerShell } from '@/homeowner/HomeownerShell';

export default function HomeownerContactPage() {
  return (
    <HomeownerShell>
      <main className="bg-navy-dark min-h-screen">
        <Navbar />
        <ContactPage />
        <Footer />
      </main>
    </HomeownerShell>
  );
}
