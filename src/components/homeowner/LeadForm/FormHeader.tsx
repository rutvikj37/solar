import { motion } from 'framer-motion';

export function FormHeader({ step }: { step: number }) {
  const steps = ["YOU", "PROPERTY", "HOME", "SOLAR"];
  
  return (
    <div className="mb-8">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">FREE SOLAR ANALYSIS</p>
      <h2 className="text-3xl font-extrabold tracking-tighter text-white mb-2">Let's Find Your Home's Solar Potential.</h2>
      <p className="text-white/60 text-sm mb-6">Answer a few simple questions and we'll analyze your property and prepare your free solar report.</p>
      
      <div className="flex gap-4 items-center">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 ${i === step ? 'text-white' : 'text-white/30'}`}>
            <span className={`form-step-indicator ${i === step ? 'text-cyan-400' : ''}`}>0{i + 1} {s}</span>
            {i < steps.length - 1 && <span className="text-white/20">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}