import React from 'react';

const MODES = ['Satellite', 'Hybrid', 'Dark'];

export default function MapModePill({ mapType, onChange, dimmed = false }) {
  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full p-1 flex items-center gap-1 shrink-0 transition-opacity ${
        dimmed ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {MODES.map((type) => {
        const value = type.toLowerCase();
        const active = mapType === value;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(value)}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider transition-all uppercase ${
              active
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105'
                : 'text-slate-200 hover:text-on-surface hover:bg-white/10 bg-transparent'
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
