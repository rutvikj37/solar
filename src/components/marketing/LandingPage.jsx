import { Toaster } from 'sonner';
import { Nav } from './Nav';
import { Hero } from './Hero';
import { Journey } from './Journey';
import { NeighborhoodScan } from './NeighborhoodScan';
import { Dashboard } from './Dashboard';
import { WhyUs } from './WhyUs';
import { Partner } from './Partner';
import { Pricing } from './Pricing';
import { FinalCTA, Footer } from './FinalCTA';
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
