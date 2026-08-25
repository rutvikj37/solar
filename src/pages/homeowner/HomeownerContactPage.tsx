import { Navbar } from '@/components/homeowner/Navbar';
import { ContactPage } from '@/components/homeowner/ContactPage';
import { Footer } from '@/components/homeowner/Footer';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';

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
