import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

export function MobileStickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[100] md:hidden glass-sticky-mobile px-4 py-3 safe-bottom-padding"
        >
          <div className="max-w-[500px] mx-auto flex items-center gap-3">
            <div className="flex-1">
              <button className="w-full relative group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-navy-dark shadow-[0_8px_25px_-5px_oklch(0.75_0.18_190_/_0.5)] active:scale-[0.98] transition-transform">
                Calculate My Savings
                <ArrowRight className="size-4" />
              </button>
            </div>
            
            <div className="shrink-0 flex flex-col items-center justify-center opacity-80">
              <ShieldCheck className="size-4 text-cyan-400 mb-0.5" />
              <span className="text-[8px] font-black text-cyan-400 uppercase tracking-tighter">100% Free</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
