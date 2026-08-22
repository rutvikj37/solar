import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  MapPin, Home, PhoneCall, ChevronDown, ChevronLeft, ChevronRight,
  FileText, Sun, Mountain, Zap, ArrowRight, ShieldCheck, DollarSign,
  Lock, Gauge, BadgeCheck, Search, Star, CheckCircle2, Orbit
} from 'lucide-react';

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-navy-dark py-20 md:py-28 px-4 md:px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block rounded-full border border-cyan-400/40 px-6 py-2 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-cyan-400"
          >
            How It Works
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1]"
          >
            From Your Home to<br className="hidden sm:block" />{' '}
            the <span className="text-cyan-400">Right Solar Installer.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-white/50 text-sm md:text-base font-medium"
          >
            One simple process. Powered by SolarXAI.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="space-y-14 md:space-y-16">
          <StepPanel
            number="01"
            title="Fill Simple Form"
            description="Enter your address and a few details. It takes less than 30 seconds."
            bullets={[
              { icon: MapPin, label: 'Your Address' },
              { icon: Home, label: 'Home Details' },
              { icon: PhoneCall, label: 'Contact Info' },
            ]}
            visual={<PhoneVisual />}
            clipVisual
          />

          <StepPanel
            number="02"
            title={<>Our AI Analyzes<br className="hidden md:block" /> Your Property<br className="hidden md:block" /> From Space</>}
            description="Our AI scans your roof, analyzes sunlight, size, and potential from high-resolution satellite data."
            note={
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="size-10 shrink-0 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <FileText className="size-5 text-cyan-400" />
                </div>
                <p className="text-sm text-white/70 font-medium leading-snug">
                  You get a <span className="font-black text-cyan-400">FREE</span> detailed solar report.
                </p>
              </div>
            }
            visual={<SatelliteVisual />}
          />

          <StepPanel
            number="03"
            title={<>We Filter &amp; Connect<br className="hidden md:block" /> You with the Best<br className="hidden md:block" /> Solar Installer</>}
            description="Our advanced system filters trusted installers and connects you with the best match for your home."
            visual={<InstallerVisual />}
            last
          />
        </div>

        {/* CTA panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 md:mt-16 rounded-[32px] border border-white/[0.08] bg-white/[0.02] p-6 md:p-10 grid md:grid-cols-2 gap-8 items-center"
        >
          <div className="flex items-start gap-5">
            <div className="size-14 shrink-0 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
              <ShieldCheck className="size-7 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-extrabold text-cyan-400 tracking-tight">
                100% Free. No Obligation.
              </h3>
              <p className="mt-2 text-sm text-white/55 font-medium leading-relaxed">
                Get your free solar report and see your savings potential in just a few taps.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <button className="group w-full rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 px-8 py-5 text-sm md:text-base font-extrabold text-navy-dark tracking-tight transition-all hover:brightness-110 active:scale-[0.99] shadow-[0_20px_40px_-14px_oklch(0.75_0.18_190_/_0.5)]">
              <span className="flex items-center justify-center gap-3">
                Get My Free Solar Report
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {['A', 'M', 'J', 'K'].map((c, i) => (
                  <div
                    key={i}
                    className="size-9 rounded-full border-2 border-navy-dark bg-gradient-to-br from-cyan-500/40 to-sky-700/40 flex items-center justify-center text-[11px] font-black text-white"
                  >
                    {c}
                  </div>
                ))}
              </div>
              <p className="text-[11px] md:text-xs text-white/50 font-medium leading-snug">
                Join 10,000+ homeowners<br />who already got their free report.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Trust bar */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: DollarSign, title: '100% FREE', sub: 'No hidden charges.' },
            { icon: Lock, title: 'SECURE & PRIVATE', sub: 'Your data is safe with us.' },
            { icon: Gauge, title: 'QUICK & EASY', sub: 'Get your report in minutes.' },
            { icon: BadgeCheck, title: 'TRUSTED NETWORK', sub: 'We work only with verified installers.' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-start gap-3"
            >
              <div className="size-10 shrink-0 rounded-full border border-cyan-400/25 bg-cyan-500/10 flex items-center justify-center">
                <item.icon className="size-4.5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[11px] font-black text-cyan-400 tracking-wide">{item.title}</p>
                <p className="mt-1 text-[11px] text-white/50 font-medium leading-snug">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepPanel({
  number, title, description, bullets, note, visual, last, clipVisual,
}: {
  number: string;
  title: React.ReactNode;
  description: string;
  bullets?: { icon: React.ElementType; label: string }[];
  note?: React.ReactNode;
  visual: React.ReactNode;
  last?: boolean;
  clipVisual?: boolean;
}) {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        className={`relative rounded-[32px] border border-cyan-400/10 bg-[#060B17] p-5 sm:p-6 md:p-10 grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] gap-8 lg:gap-10 items-center ${clipVisual ? 'overflow-hidden' : ''}`}
      >
        <div className="flex gap-5 md:gap-6">
          <div className="relative shrink-0">
            <div className="size-12 md:size-14 rounded-full bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white font-black text-base md:text-lg shadow-[0_0_30px_oklch(0.75_0.18_230_/_0.45)]">
              {number}
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">{title}</h3>
            <p className="mt-3 text-sm md:text-[15px] text-white/55 font-medium leading-relaxed">{description}</p>
            {bullets && (
              <ul className="mt-6 space-y-4">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/85 text-sm font-semibold">
                    <b.icon className="size-4.5 text-cyan-400" />
                    {b.label}
                  </li>
                ))}
              </ul>
            )}
            {note}
          </div>
        </div>

        <div className="relative flex justify-center items-center">{visual}</div>
      </motion.div>

      {!last && (
        <div className="absolute left-1/2 -bottom-7 -translate-x-1/2 z-20">
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="size-11 rounded-full border border-cyan-400/25 bg-[#060B17] flex items-center justify-center"
          >
            <ChevronDown className="size-5 text-cyan-400" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function PhoneVisual() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });
  const [addressText, setAddressText] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [roofType, setRoofType] = useState("");
  const [step, setStep] = useState(0); // 0: start, 1: typing address, 2: property type, 3: roof type, 4: complete

  const fullAddress = "1042 Cedar Ridge Dr, Phoenix, AZ";

  useEffect(() => {
    if (!isInView) return;

    let timeout: any;
    
    if (step === 0) {
      timeout = setTimeout(() => setStep(1), 500);
    } else if (step === 1) {
      if (addressText.length < fullAddress.length) {
        timeout = setTimeout(() => {
          setAddressText(fullAddress.slice(0, addressText.length + 1));
        }, 50 + Math.random() * 50);
      } else {
        timeout = setTimeout(() => setStep(2), 800);
      }
    } else if (step === 2) {
      timeout = setTimeout(() => {
        setPropertyType("Single Family Home");
        setStep(3);
      }, 600);
    } else if (step === 3) {
      timeout = setTimeout(() => {
        setRoofType("Shingle");
        setStep(4);
      }, 600);
    }

    return () => clearTimeout(timeout);
  }, [isInView, step, addressText]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ y: 40, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', damping: 22, stiffness: 70 }}
      className="relative w-full max-w-[300px] -mb-16 md:-mb-24"
    >
      <div className="absolute -top-3 -right-3 z-20 size-14 rounded-full bg-[#0B1730] border border-cyan-400/25 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.25)]">
        <FileText className="size-6 text-cyan-300" />
      </div>

      <div className="rounded-t-[40px] border-[10px] border-b-0 border-[#121A2A] bg-white pt-8 px-5 pb-6 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#121A2A] rounded-b-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Step 1 of 3</p>
        <div className="mt-2 flex gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-sky-500" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${step >= 4 && i === 0 ? 'bg-sky-500' : 'bg-slate-200'}`} />
          ))}
        </div>
        <h4 className="mt-4 text-base font-extrabold text-slate-900 tracking-tight">Tell us about your home</h4>

        <div className="mt-4 space-y-3">
          <div className="h-11 rounded-lg border border-slate-200 flex items-center justify-between px-3 text-[13px] text-slate-900 font-medium">
            <span className="flex items-center">
              {addressText || <span className="text-slate-400">Enter your address</span>}
              {step === 1 && addressText.length < fullAddress.length && (
                <span className="w-0.5 h-4 bg-cyan-500 ml-0.5 cursor-blink" />
              )}
            </span>
            <Search className="size-4 text-slate-400" />
          </div>
          <div className="h-11 rounded-lg border border-slate-200 flex items-center justify-between px-3 text-[13px] font-medium">
            <span className={propertyType ? 'text-slate-900' : 'text-slate-400'}>
              {propertyType || "Select Property Type"}
            </span>
            <ChevronDown className="size-4 text-slate-400" />
          </div>
          <div className="h-11 rounded-lg border border-slate-200 flex items-center justify-between px-3 text-[13px] font-medium">
            <span className={roofType ? 'text-slate-900' : 'text-slate-400'}>
              {roofType || "Select Roof Type"}
            </span>
            <ChevronDown className="size-4 text-slate-400" />
          </div>
          <button 
            className={`w-full h-12 rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 text-white text-sm font-extrabold transition-all duration-500 ${step === 4 ? 'cta-glow-pulse scale-[1.02]' : ''}`}
          >
            Get My Free Report
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SatelliteVisual() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.5 });
  const [stage, setStage] = useState(0); 

  useEffect(() => {
    let isActive = true;

    const sequence = async () => {
      while (isActive && isInView) {
        setStage(0); // Orbit
        await new Promise(r => setTimeout(r, 1500));
        if (!isActive || !isInView) break;
        
        setStage(1); // Earth Approach
        await new Promise(r => setTimeout(r, 1500));
        if (!isActive || !isInView) break;
        
        setStage(2); // City View
        await new Promise(r => setTimeout(r, 1500));
        if (!isActive || !isInView) break;
        
        setStage(3); // Neighborhood Scan
        await new Promise(r => setTimeout(r, 1500));
        if (!isActive || !isInView) break;
        
        setStage(4); // Select Property / Detected
        await new Promise(r => setTimeout(r, 1200));
        if (!isActive || !isInView) break;
        
        setStage(5); // Roof Scan
        await new Promise(r => setTimeout(r, 2000));
        if (!isActive || !isInView) break;
        
        setStage(6); // Results
        await new Promise(r => setTimeout(r, 4000));
      }
    };

    if (isInView) {
      sequence();
    } else {
      setStage(0);
    }

    return () => {
      isActive = false;
    };
  }, [isInView]);

  return (
    <div ref={containerRef} className="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden border border-white/10 bg-[#060B17] shadow-2xl">
      {/* Zooming Images Layer */}
      <div className="absolute inset-0 z-0">
        {/* Stage 0-2: City Wide */}
        <motion.div
          animate={{ 
            scale: stage >= 2 ? 3.5 : (stage === 1 ? 1.4 : 1),
            opacity: stage >= 2 ? 0 : 1,
            y: stage === 1 ? 20 : 0
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/city-aerial-wide.jpg" 
            alt="Wide city view" 
            className="w-full h-full object-cover brightness-[0.5] contrast-[1.1]" 
          />
        </motion.div>

        {/* Stage 2-3: Neighborhood */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: stage >= 2 ? (stage >= 3 ? 0 : 1) : 0,
            scale: stage >= 2 ? (stage >= 3 ? 2.5 : 1) : 0.5
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/neighborhood-aerial.jpg" 
            alt="Neighborhood view" 
            className="w-full h-full object-cover brightness-[0.55] contrast-[1.1]" 
          />
        </motion.div>

        {/* Stage 3+: Home / Roof */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ 
            opacity: stage >= 3 ? 1 : 0,
            scale: stage >= 3 ? (stage >= 5 ? 1.4 : 1) : 0.6
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/roof-aerial.jpg" 
            alt="Home roof view" 
            className="w-full h-full object-cover brightness-[0.6] contrast-[1.05]" 
          />
        </motion.div>

        {/* Atmospheric Glow Overlay for space start */}
        <motion.div 
          animate={{ opacity: stage === 0 ? 0.4 : 0 }}
          className="absolute inset-0 bg-sky-500/10 pointer-events-none" 
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#060B17] via-transparent to-[#060B17]/40" />
      </div>

      {/* Satellite UI Elements */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Satellite Indicator Badge */}
        <AnimatePresence>
          {stage >= 0 && stage < 4 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
            >
              <div className="flex items-center gap-2 rounded-full bg-navy-dark/80 border border-white/20 px-3 py-1 backdrop-blur-md">
                <Orbit className="size-3 text-white/60 animate-spin-slow" />
                <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">
                  {stage === 0 ? "Satellite In Orbit" : 
                   stage === 1 ? "Earth Approach" :
                   stage === 2 ? "City Analysis" : "Neighborhood Scan"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Satellite Visual */}
        <AnimatePresence>
          {stage < 3 && (
            <motion.div
              initial={{ opacity: 0, x: 50, y: -50, scale: 0.2 }}
              animate={{ 
                opacity: 1, 
                x: stage === 1 ? -20 : (stage === 2 ? -80 : 0), 
                y: stage === 1 ? 20 : (stage === 2 ? 80 : 0),
                scale: stage === 0 ? 0.3 : (stage === 1 ? 0.6 : 1.2)
              }}
              exit={{ opacity: 0, scale: 2 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute top-8 right-8 w-32 h-32"
            >
              <SatelliteSVG />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan Beam / Search Pattern */}
        <AnimatePresence>
          {stage === 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden bg-cyan-400/5"
            >
              <svg className="w-full h-full" viewBox="0 0 400 300">
                <motion.rect
                  width="100" height="100"
                  fill="rgba(34, 211, 238, 0.1)"
                  stroke="rgba(34, 211, 238, 0.3)"
                  strokeWidth="1"
                  animate={{ 
                    x: [50, 250, 100, 200], 
                    y: [50, 150, 200, 100] 
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Property Detected Marker */}
        <AnimatePresence>
          {stage >= 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
            >
              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="size-20 rounded-full border border-white/50 bg-white/10" 
                />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-white px-3 py-1 rounded text-[10px] font-black text-navy-dark uppercase tracking-wider"
              >
                Property Detected
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Roof Scan Visuals */}
        {stage >= 5 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 bg-cyan-400/5"
            >
              <svg viewBox="0 0 400 300" className="w-full h-full">
                {/* Roof Boundary */}
                <motion.path
                  d="M 150 120 L 280 120 L 320 200 L 110 200 Z"
                  fill="none"
                  stroke="rgba(34, 211, 238, 0.8)"
                  strokeWidth="2"
                  strokeDasharray="1000"
                  initial={{ strokeDashoffset: 1000 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.5, ease: "linear" }}
                />
                
                {/* Scan Line */}
                <motion.line
                  x1="100" y1="120" x2="330" y2="120"
                  stroke="rgba(34, 211, 238, 1)"
                  strokeWidth="2"
                  animate={{ y: [0, 80, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                />

                {/* AI Points */}
                {[
                  { x: 180, y: 140 }, { x: 250, y: 150 }, { x: 220, y: 170 },
                  { x: 160, y: 180 }, { x: 280, y: 160 }
                ].map((pt, i) => (
                  <motion.circle
                    key={i}
                    cx={pt.x} cy={pt.y} r="2"
                    fill="cyan"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </svg>
            </motion.div>

            {/* AI Status Text (Small floating indicators) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-2 z-30"
            >
              {[
                "Roof Detected",
                "Roof Scan",
                "Sun Exposure Analysis",
                "Solar Potential"
              ].map((text, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.4 }}
                  className="flex items-center gap-2"
                >
                  <div className="size-1.5 rounded-full bg-cyan-400" />
                  <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>

      {/* Floating Data Chips Reveal */}
      <AnimatePresence>
        {stage >= 6 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <div className="relative w-full h-full sm:h-auto sm:grid sm:grid-cols-3 sm:gap-3 sm:max-w-lg pointer-events-auto">
              {[
                { label: 'Sun Exposure', value: 'Excellent', icon: Sun, pos: 'top-2 right-2 sm:top-auto sm:right-auto' },
                { label: 'Roof Suitability', value: 'High', icon: Mountain, pos: 'bottom-2 right-2 sm:bottom-auto sm:right-auto' },
                { label: 'Solar Potential', value: '92 / 100', icon: Zap, pos: 'bottom-2 left-2 sm:bottom-auto sm:left-auto' },
              ].map((res, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.2, type: 'spring', damping: 15 }}
                  className={`absolute sm:relative ${res.pos} rounded-xl sm:rounded-2xl border border-white/10 bg-navy-dark/90 p-2 sm:p-3.5 backdrop-blur-xl shadow-xl w-auto min-w-[110px] sm:min-w-0 sm:w-full`}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="size-6 sm:size-8 shrink-0 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <res.icon className="size-3 sm:size-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-[7px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-none">
                        {res.label}
                      </p>
                      <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-sm font-black text-cyan-400 tracking-tight leading-none">
                        {res.value}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SatelliteSVG() {
  return (
    <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
      {/* Metallic Satellite Body */}
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect x="42" y="38" width="16" height="24" rx="3" fill="url(#bodyGrad)" stroke="#1E293B" strokeWidth="1" />
      
      {/* Solar Panels (Realistic) */}
      <motion.g
        animate={{ rotate: [-1, 1, -1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="8" y="44" width="34" height="12" rx="2" fill="#0369A1" />
        <rect x="58" y="44" width="34" height="12" rx="2" fill="#0369A1" />
        
        {/* Panel Detail */}
        <rect x="10" y="46" width="30" height="8" fill="url(#panelPattern)" opacity="0.4" />
        <rect x="60" y="46" width="30" height="8" fill="url(#panelPattern)" opacity="0.4" />
        <defs>
          <pattern id="panelPattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="2" height="2" fill="white" />
          </pattern>
        </defs>
      </motion.g>

      {/* Optics Lens */}
      <circle cx="50" cy="62" r="6" fill="#0F172A" stroke="#334155" strokeWidth="2" />
      <circle cx="50" cy="62" r="3" fill="#1E293B" />
      
      {/* Reflector */}
      <path d="M 40 68 Q 50 72 60 68" stroke="#64748B" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function InstallerVisual() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });
  const [isMatching, setIsMatching] = useState(false);
  const [matched, setMatched] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0);

  const mockInstallers = [
    "SunPeak Solar", "Bright Future", "EcoPower Systems", "Volt Solar",
    "GreenGrid Energy", "PureSky Solar", "Lumina Power", "Nova Energy",
    "Apex Solar Solutions", "SolarPro Solutions"
  ];

  useEffect(() => {
    if (!isInView) return;

    setIsMatching(true);
    let count = 0;
    const interval = setInterval(() => {
      setCycleIndex(prev => (prev + 1) % mockInstallers.length);
      count++;
      if (count >= 15) { // Cycle through ~1.5 rounds
        clearInterval(interval);
        setCycleIndex(mockInstallers.length - 1); // End on SolarPro
        setIsMatching(false);
        setMatched(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isInView]);

  const installers = [
    { name: 'SunPeak Solar', rating: '4.6', match: '78% Match', best: false },
    { name: 'SolarPro Solutions', rating: '4.9', match: '92% Match', best: true },
    { name: 'Bright Future Energy', rating: '4.5', match: '74% Match', best: false },
  ];

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex items-center gap-2 md:gap-3">
        <button className="hidden sm:flex size-8 shrink-0 rounded-full border border-white/10 text-white/40 items-center justify-center hover:text-cyan-300 transition-colors">
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 flex-1">
          {installers.map((inst, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: matched ? (inst.best ? 1 : 0.4) : (isMatching ? 1 : 0), 
                y: matched || isMatching ? 0 : 20,
                scale: matched && inst.best ? 1.04 : 1
              }}
              className={`relative rounded-2xl border p-3 md:p-4 text-center transition-all duration-500 ${
                matched && inst.best
                  ? 'border-emerald-400/50 bg-emerald-400/[0.06] shadow-[0_0_40px_-10px_rgba(52,211,153,0.4)]'
                  : 'border-white/10 bg-white/[0.02]'
              } ${!inst.best ? 'hidden sm:block' : 'block'}`}
            >
              {isMatching && inst.best && (
                <div className="absolute inset-0 z-10 bg-navy-dark rounded-2xl flex flex-col items-center justify-center p-2">
                  <Search className="size-6 text-cyan-400 animate-pulse mb-2" />
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest animate-pulse">
                    {mockInstallers[cycleIndex]}
                  </p>
                </div>
              )}

              {matched && inst.best && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-navy-dark whitespace-nowrap z-20"
                >
                  ✓ QUALIFIED MATCH
                </motion.span>
              )}
              
              <div className={`mx-auto mt-2 size-10 sm:size-12 rounded-full flex items-center justify-center ${inst.best ? 'bg-gradient-to-br from-amber-300 to-sky-400' : 'bg-white/[0.06]'}`}>
                <Sun className={`size-5 sm:size-6 ${inst.best ? 'text-navy-dark' : 'text-white/40'}`} />
              </div>
              <p className={`mt-3 text-[12px] md:text-sm font-extrabold leading-tight ${inst.best ? 'text-white' : 'text-white/80'}`}>
                {inst.name}
              </p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-bold text-white/70">{inst.rating}</span>
              </div>
              <p className={`mt-2 text-[12px] font-black ${inst.best ? 'text-emerald-400' : 'text-cyan-400/70'}`}>{inst.match}</p>
            </motion.div>
          ))}
          
          {/* Mobile indicator for hidden cards */}
          <div className="sm:hidden text-center mt-2">
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
              {isMatching ? "Finding matches..." : "+ 2 Other Local Matches"}
            </p>
          </div>
        </div>

        <button className="hidden sm:flex size-8 shrink-0 rounded-full border border-white/10 text-white/40 items-center justify-center hover:text-cyan-300 transition-colors">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 text-[11px] font-bold text-emerald-400">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Verified</span>
        <span className="text-white/20">•</span>
        <span>Licensed</span>
        <span className="text-white/20">•</span>
        <span>Trusted</span>
      </div>
    </div>
  );
}
