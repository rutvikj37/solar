import React from 'react';
import { getStatusConfig } from '../../lib/leads.js';

const BADGE_STYLES = {
  blue: 'bg-blue-500/12 text-blue-300 border-blue-500/25',
  cyan: 'bg-cyan-500/12 text-cyan-300 border-cyan-500/25',
  amber: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
  orange: 'bg-orange-500/12 text-orange-300 border-orange-500/25',
  purple: 'bg-purple-500/12 text-purple-300 border-purple-500/25',
  sky: 'bg-sky-500/12 text-sky-300 border-sky-500/25',
  green: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  slate: 'bg-slate-500/12 text-slate-300 border-slate-500/25',
};

export default function LeadStatusBadge({ status, size = 'sm', configMap = null }) {
  const cfg =
    (configMap && configMap[status || 'new']) || getStatusConfig(status || 'new');
  const style = BADGE_STYLES[cfg.color] || BADGE_STYLES.blue;
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${style} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot || 'bg-slate-400'}`} />
      {cfg.label}
    </span>
  );
}
