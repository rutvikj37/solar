import React from 'react';

const MODES = ['Satellite', 'Hybrid', 'Dark'];

export default function MapModePill({ mapType, onChange, dimmed = false }) {
  return (
    <div
      className={`glass-card p-1 rounded-full border border-glass-stroke shadow-xl flex items-center gap-1 transition-opacity ${
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
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all uppercase ${
              active
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-white bg-transparent'
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
