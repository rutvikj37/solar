import React from 'react';
import { getScoreTier } from '../../lib/leads.js';

export default function LeadScoreBadge({ score, showBar = false, compact = false }) {
  const n = Number(score) || 0;
  const tier = getScoreTier(n);
  const layout = compact
    ? 'flex-row items-center gap-1.5'
    : showBar
      ? 'flex-col items-start gap-1 w-[4.75rem]'
      : 'flex-col items-end gap-1';

  return (
    <div className={`flex ${layout}`}>
      <span className={`inline-flex items-center gap-1 rounded-md border font-mono font-bold tabular-nums ${tier.className} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}>
        {n}
        {!compact && <span className="opacity-60 font-normal">/100</span>}
      </span>
      {!compact && (
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{tier.label}</span>
      )}
      {showBar && (
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${n >= 85 ? 'bg-emerald-400' : n >= 70 ? 'bg-amber-400' : 'bg-sky-400'}`}
            style={{ width: `${Math.min(100, Math.max(0, n))}%` }}
          />
        </div>
      )}
    </div>
  );
}
