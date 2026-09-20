import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Orbit, MapPin, Sun, Mountain, Zap } from 'lucide-react';

export function AnalysisLoader({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const sequence = async () => {
      // 0: Orbit / Locating (0.5s)
      await new Promise(r => setTimeout(r, 500));
      setStage(1);
      
      // 1: City Approach (0.5s)
      await new Promise(r => setTimeout(r, 500));
      setStage(2);
      
      // 2: Neighborhood Zoom (0.5s)
      await new Promise(r => setTimeout(r, 500));
      setStage(3);
      
      // 3: Property Detected (0.5s)
      await new Promise(r => setTimeout(r, 500));
      setStage(4);
      
      // 4: Roof Scan (0.7s)
      await new Promise(r => setTimeout(r, 700));
      setStage(5);
      
      // 5: Finalizing (0.3s)
      await new Promise(r => setTimeout(r, 300));
      onComplete();
    };

    sequence();
  }, [onComplete]);

  const labels = [
    "Locating Your Property",
    "Analyzing neighborhood",
    "identifying your Home",
    "Scanning Your Roof",
    "Calculating Solar Potential",
    "Finalizing Report"
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-[#060B17] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Visuals */}
      <div className="absolute inset-0 z-0">
         {/* Zooming Images Layer */}
        <motion.div
          animate={{ 
            scale: stage >= 2 ? 3.5 : (stage === 1 ? 1.4 : 1),
            opacity: stage >= 2 ? 0 : 0.6,
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/city-aerial-wide.jpg" 
            alt="" 
            className="w-full h-full object-cover brightness-[0.4] contrast-[1.1]" 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: stage >= 2 ? (stage >= 3 ? 0 : 0.7) : 0,
            scale: stage >= 2 ? (stage >= 3 ? 2.5 : 1) : 0.5
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/neighborhood-aerial.jpg" 
            alt="" 
            className="w-full h-full object-cover brightness-[0.5] contrast-[1.1]" 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ 
            opacity: stage >= 3 ? 0.8 : 0,
            scale: stage >= 3 ? (stage >= 5 ? 1.4 : 1) : 0.6
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src="/roof-aerial.jpg" 
            alt="" 
            className="w-full h-full object-cover brightness-[0.55] contrast-[1.05]" 
          />
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#060B17] via-transparent to-[#060B17]/40" />
      </div>

      {/* Scanning Overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <AnimatePresence>
          {stage === 4 && (
             <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20"
              >
                <svg viewBox="0 0 400 300" className="w-full h-full">
                  <motion.path
                    d="M 150 120 L 280 120 L 320 200 L 110 200 Z"
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.8)"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                  <motion.line
                    x1="100" y1="120" x2="330" y2="120"
                    stroke="rgba(34, 211, 238, 1)"
                    strokeWidth="2"
                    animate={{ y: [0, 80, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </svg>
             </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {stage === 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
            >
              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="size-32 rounded-full border-2 border-cyan-400 bg-cyan-400/10" 
                />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-12 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="mb-8"
        >
          <Orbit className="size-16 text-cyan-400" />
        </motion.div>
        
        <div className="text-center h-8 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-cyan-400 text-sm font-black uppercase tracking-[0.3em]"
            >
              {labels[stage]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-12 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: `${((stage + 1) / labels.length) * 100}%` }}
            className="h-full bg-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}
