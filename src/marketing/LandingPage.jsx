import { Toaster } from 'sonner';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Journey } from './components/Journey';
import { NeighborhoodScan } from './components/NeighborhoodScan';
import { Dashboard } from './components/Dashboard';
import { WhyUs } from './components/WhyUs';
import { Partner } from './components/Partner';
import { Pricing } from './components/Pricing';
import { FinalCTA, Footer } from './components/FinalCTA';
import './styles.css';

export default function LandingPage() {
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
