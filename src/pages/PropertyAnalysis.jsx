import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';

export default function PropertyAnalysis() {
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [showPopup, setShowPopup] = useState(true);

  const handleEnrich = () => {
    setEnriching(true);
    setTimeout(() => {
      setEnriching(false);
      setEnriched(true);
    }, 1800);
  };

  return (
    <AppLayout>
      <div className="relative h-[calc(100vh-140px)] w-full rounded-2xl overflow-hidden bg-[#111319] border border-glass-stroke">
        {/* Background Map Grid Pattern */}
        <div 
          onClick={() => setShowPopup(prev => !prev)}
          className="absolute inset-0 bg-cover bg-center opacity-40 grayscale cursor-pointer"
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBGD2L8HVyXoGN5-K4M1oZyxbZYTrbZv8No351Ghwc2JNdXRRn2YQE1hv8PlXbPTCPqJWknp1zGNhd5fByadCXhOLoQ9x1rDkkMYkslbGHcbsGb43V6BD2S37xi35gqb79-7HZ8n-4MSFuylNS98qT_xnXUd30j4xoKlval4qXhvopw-BmHHCHo_5vQBq4Sk20oQ_NB9M3LsBo7KUMvaES1DjylnRYX3PEU0bnpm2Gaw_mUrLxmLqyR')" }}
        />

        {/* Pulse Marker */}
        <div 
          onClick={(e) => { e.stopPropagation(); setShowPopup(true); }}
          className="absolute top-[52%] left-[48%] -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer hover:scale-110 transition-transform"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 bg-primary/30 rounded-full animate-ping"></div>
            <div className="relative w-4 h-4 bg-primary border-2 border-white rounded-full shadow-[0_0_15px_rgba(173,198,255,0.8)]"></div>
          </div>
        </div>

        {/* PROPERTY POPUP OVERLAY */}
        {showPopup && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-full max-w-[500px] px-4 animate-in fade-in zoom-in duration-300">
            <div className="glass-card rounded-2xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
              {/* Satellite Thumbnail with Overlay */}
              <div className="relative h-48 sm:h-56 w-full bg-surface-container-highest">
                <img 
                  className="w-full h-full object-cover opacity-80" 
                  alt="Rooftop analysis visualization" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAegPtIvyY1q4W5k0XfsAoTk4FBzA0pYgswigeH-jFcmye74Fo9jShjuLRSabudN27dSdS-bDcCttv7p_jTLjpxOivXjmB0t0L-LG_mKGF6wjQPRRoDij3eDhxO5xL0cU0XPHZgruLspzq87nEY5NU-9pAmthMlxsbbwjEtXqpqqSQXeqh8YtqLRugO4lJY_jLcmmB0cru9iB_E1ZwYEYgutrgjjsFAZRY-w14gMKwmOkwziAv8XYxe"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated via-transparent to-transparent"></div>
                
                {/* Lead Score Badge */}
                <div className="absolute top-4 right-4 bg-primary-container/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-primary/20 flex flex-col items-center">
                  <span className="text-[8px] font-label-mono text-on-primary-container font-bold tracking-tighter">LEAD SCORE</span>
                  <span className="font-headline-md text-base text-on-primary-container leading-none font-bold">94<span className="text-[10px] opacity-60">/100</span></span>
                </div>

                {/* Location Header */}
                <div className="absolute bottom-4 left-6">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                    <span className="font-label-mono text-on-surface-variant text-[9px] tracking-widest uppercase">Target Property</span>
                  </div>
                  <h2 className="font-headline-md text-lg md:text-xl font-bold text-white">824 Sunnyvale Dr.</h2>
                </div>
              </div>

              {/* Data Grid */}
              <div className="p-6 space-y-6 bg-surface-elevated/40">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* Potential */}
                  <div className="space-y-0.5">
                    <p className="font-label-mono text-on-surface-variant text-[9px] tracking-wider uppercase">Solar Potential</p>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-green-400 text-base">verified</span>
                      <span className="font-headline-md text-sm md:text-base text-white font-semibold">Excellent</span>
                    </div>
                  </div>
                  {/* System Size */}
                  <div className="space-y-0.5">
                    <p className="font-label-mono text-on-surface-variant text-[9px] tracking-wider uppercase">Est. System Size</p>
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-headline-md text-sm md:text-base text-white font-semibold">12.4</span>
                      <span className="font-label-mono text-primary text-xs font-bold">kW</span>
                    </div>
                  </div>
                  {/* Area */}
                  <div className="space-y-0.5">
                    <p className="font-label-mono text-on-surface-variant text-[9px] tracking-wider uppercase">Usable Roof Area</p>
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-headline-md text-sm md:text-base text-white font-semibold">2,100</span>
                      <span className="font-label-mono text-on-surface-variant text-xs">sq ft</span>
                    </div>
                  </div>
                  {/* Savings */}
                  <div className="space-y-0.5">
                    <p className="font-label-mono text-on-surface-variant text-[9px] tracking-wider uppercase">Annual Savings</p>
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-headline-md text-sm md:text-base text-white font-semibold">$1,850</span>
                      <span className="font-label-mono text-on-surface-variant text-xs">/ yr</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-glass-stroke"></div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Link 
                    to="/lead/1" 
                    className="w-full sm:flex-1 bg-surface-container-highest border border-glass-stroke hover:bg-surface-bright text-white font-button py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    View Full Report
                  </Link>

                  <button 
                    disabled={enriching || enriched}
                    onClick={handleEnrich}
                    className={`w-full sm:flex-[1.3] font-button py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-bold shadow-lg ${
                      enriched 
                        ? 'bg-green-500 text-white' 
                        : enriching 
                          ? 'bg-primary/80 text-on-primary cursor-not-allowed' 
                          : 'bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] shadow-primary/20'
                    }`}
                  >
                    {enriching ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                        Enriching Data...
                      </>
                    ) : enriched ? (
                      <>
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        Lead Qualified
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                        Generate Qualified Lead
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setShowPopup(false)}
                className="absolute top-4 left-4 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Bottom Indicator for Map Anchor */}
            <div className="flex justify-center -mt-1">
              <div className="w-3.5 h-3.5 bg-surface-elevated border-r border-b border-glass-stroke rotate-45"></div>
            </div>
          </div>
        )}

        {/* Floating controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-10">
          <div className="glass-card p-1.5 rounded-xl flex flex-col gap-1.5">
            <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">add</span>
            </button>
            <div className="h-px bg-glass-stroke mx-1.5"></div>
            <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
          <button 
            onClick={() => setShowPopup(true)}
            className="w-11 h-11 glass-card rounded-full flex items-center justify-center text-primary shadow-xl hover:scale-110 transition-transform"
          >
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
