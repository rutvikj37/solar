import { Navbar } from "@/components/solar/Navbar";
import { HouseVisual } from "@/components/solar/HouseVisual";
import { DataCard } from "@/components/solar/DataCard";
import { Sun, Zap, Layout, ArrowRight, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

export function SolarHero() {
  const [stage, setStage] = useState(0);
  const [showCards, setShowCards] = useState([false, false, false]);

  useEffect(() => {
    // Stage 0: House appears (0s)
    
    // Stage 1: Sun brightness increase (1s)
    const t1 = setTimeout(() => setStage(1), 1000);
    
    // Stage 2: Sunlight rays travel to panels (2s)
    const t2 = setTimeout(() => setStage(2), 2000);
    
    // Stage 3: Reflection sweep (3.5s)
    const t3 = setTimeout(() => setStage(3), 3500);
    
    // Stage 4: AI roof scan starts (4s)
    const t4 = setTimeout(() => setStage(4), 4000);
    
    // Stage 5: Reveal cards (starts at 5s)
    const t5 = setTimeout(() => {
      setStage(5);
      // Reveal cards one by one
      setTimeout(() => setShowCards([true, false, false]), 0);
      setTimeout(() => setShowCards([true, true, false]), 400);
      setTimeout(() => setShowCards([true, true, true]), 800);
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  return (
    <div className="relative min-h-[100svh] w-full bg-navy-dark overflow-hidden flex flex-col pt-16">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-start lg:flex-row lg:items-center lg:justify-center mx-auto max-w-[1500px] px-6 lg:px-12 pt-8 md:pt-12 lg:pt-16 pb-8 lg:py-4">
        <div className="grid w-full grid-cols-1 lg:items-center gap-4 lg:gap-8 lg:grid-cols-[40%_60%] lg:h-full lg:max-h-[800px]">
          {/* Left Side: Content */}
          <div className="relative z-20 py-6 lg:py-0">
            <div
              className="transition-all duration-800 ease-out"
              style={{
                opacity: stage >= 0 ? 1 : 0,
                transform: stage >= 0 ? "translateY(0)" : "translateY(20px)",
              }}
            >
              <div className="mb-4 lg:mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-md">
                <div className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                  AMERICA'S AI-POWERED SOLAR PROPERTY INTELLIGENCE
                </span>
              </div>

              <h1 className="mb-4 text-clamp-h1 font-extrabold leading-[1.05] tracking-tighter text-white">
                See How Much Your <br />
                Home Could Save <br />
                With <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200">Solar</span>.
              </h1>

              <p className="mb-6 lg:mb-8 max-w-lg text-clamp-p leading-relaxed text-white/70">
                We analyze your home from above to uncover its solar potential, estimate your energy savings, and help you find qualified installers.
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <button 
                    onClick={() => document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="cta-hover-effect group relative flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 py-3 lg:px-10 lg:py-5 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-navy-dark whitespace-nowrap"
                  >
                    Calculate My Solar Savings
                    <ArrowRight className="cta-arrow size-4 transition-transform duration-300" />
                  </button>
                </div>
                <p className="text-[10px] lg:text-[11px] font-medium text-white/40 tracking-wide px-2">
                  Free • Personalized to Your Home • No Obligation
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Visualization Area */}
          <div className="relative h-[400px] sm:h-[500px] lg:h-full w-full">
            <HouseVisual stage={stage} />

            <div className="absolute inset-0 z-30 pointer-events-none">
              {/* Card 1: upper-right near the sky */}
              <div 
                className="absolute top-[8%] right-[8%] sm:top-[10%] sm:right-[10%] transition-all duration-700 ease-out"
                style={{ 
                  opacity: showCards[0] ? 1 : 0,
                  transform: showCards[0] ? "translateY(0)" : "translateY(20px)",
                  visibility: showCards[0] ? "visible" : "hidden"
                }}
              >
                <DataCard
                  icon={TrendingUp}
                  label="SOLAR POTENTIAL"
                  value="92 / 100"
                  subValue="Excellent Potential"
                  status="complete"
                />
              </div>

              {/* Card 2: middle-left away from roof center */}
              <div 
                className="absolute top-[35%] left-[8%] sm:top-[40%] sm:right-[5%] sm:left-auto transition-all duration-700 ease-out"
                style={{ 
                  opacity: showCards[1] ? 1 : 0,
                  transform: showCards[1] ? "translateY(0)" : "translateY(20px)",
                  visibility: showCards[1] ? "visible" : "hidden"
                }}
              >
                <DataCard
                  icon={DollarSign}
                  label="EST. ANNUAL SAVINGS"
                  value="$2,180"
                  unit="/ YEAR"
                  subValue="Potential Savings"
                  status="complete"
                  trend="up"
                />
              </div>

              {/* Card 3: lower-right near bottom edge */}
              <div 
                className="absolute bottom-[10%] right-[8%] sm:bottom-[15%] sm:right-[12%] transition-all duration-700 ease-out"
                style={{ 
                  opacity: showCards[2] ? 1 : 0,
                  transform: showCards[2] ? "translateY(0)" : "translateY(20px)",
                  visibility: showCards[2] ? "visible" : "hidden"
                }}
              >
                <div className="relative group">
                  <DataCard
                    icon={Layout}
                    label="ROOF SUITABILITY"
                    value="High"
                    subValue="Well Suited for Solar"
                    status="complete"
                    highlighted={true}
                  />
                  <p className="absolute -bottom-10 right-0 w-[200px] text-[8px] leading-tight text-white/30 italic text-right pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    *Based on AI satellite analysis of your property roof area and orientation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
