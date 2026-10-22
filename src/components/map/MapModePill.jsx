import React from 'react';

const MODES = ['Satellite', 'Hybrid', 'Dark'];

export default function MapModePill({ mapType, onChange, dimmed = false }) {
  return (
    <div
      className={`map-mode-pill bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full p-0.5 sm:p-1 flex items-center gap-0.5 sm:gap-1 shrink-0 transition-opacity self-end md:self-auto ${
        dimmed ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {MODES.map((type) => {
        const value = type.toLowerCase();
        const active = mapType === value;
        const short = type === 'Satellite' ? 'Sat' : type === 'Hybrid' ? 'Hyb' : 'Dark';
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(value)}
            className={`px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wider transition-all uppercase ${
              active
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105'
                : 'text-slate-200 hover:text-on-surface hover:bg-white/10 bg-transparent'
            }`}
          >
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{type}</span>
          </button>
        );
      })}
    </div>
  );
}
