import React from 'react';

const COLORS = {
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
  green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
  purple: 'from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-400',
  amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400',
  red: 'from-red-500/20 to-red-600/5 border-red-500/30 text-red-400',
  teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/30 text-teal-400',
  sky: 'from-sky-500/20 to-sky-600/5 border-sky-500/30 text-sky-400',
  rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/30 text-rose-400',
  indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
  pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-400',
  lime: 'from-lime-500/20 to-lime-600/5 border-lime-500/30 text-lime-400',
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400',
};

export default function KpiCard({ icon, label, value, suffix, color = 'blue', trend, subtitle }) {
  const colorClass = COLORS[color] || COLORS.blue;

  return (
    <div className={`bg-gradient-to-br ${colorClass} border rounded-2xl p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-200`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.03] rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500" />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white font-display tabular-nums">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {suffix && <span className="text-[10px] font-bold opacity-60">{suffix}</span>}
          </div>
          {subtitle && <p className="text-[10px] opacity-60">{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="material-symbols-outlined text-xl opacity-50">{icon}</span>
          {trend != null && (
            <span className={`text-[9px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
