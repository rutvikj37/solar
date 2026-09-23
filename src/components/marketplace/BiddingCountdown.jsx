import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatCountdown, getCountdownUrgency } from '../../lib/marketplace.js';

const URGENCY_STYLES = {
  none: 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300',
  closed: 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400',
  normal: 'border-blue-400/40 bg-blue-50 text-blue-700 dark:border-cyan-400/45 dark:bg-cyan-500/12 dark:text-cyan-300 shadow-xs',
  urgent:
    'border-amber-400/55 bg-amber-50 text-amber-800 dark:bg-amber-500/18 dark:text-amber-300 shadow-xs animate-pulse',
  critical:
    'border-rose-400/60 bg-rose-50 text-rose-800 dark:bg-red-500/20 dark:text-red-300 shadow-xs animate-pulse',
};

/**
 * Prominent live bidding countdown badge — updates every second.
 * @param {{ closesAt?: string|null, compact?: boolean, showLabel?: boolean, className?: string }} props
 */
export default function BiddingCountdown({
  closesAt,
  compact = false,
  showLabel = true,
  className = '',
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [closesAt]);

  const label = formatCountdown(closesAt, now);
  const urgency = getCountdownUrgency(closesAt, now);
  const style = URGENCY_STYLES[urgency] || URGENCY_STYLES.none;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border font-mono tabular-nums ${style} ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'
      } ${className}`}
      title={showLabel ? undefined : 'Time left to bid'}
    >
      <Clock
        className={`shrink-0 opacity-90 ${compact ? 'w-3 h-3' : 'w-4 h-4'} ${
          urgency === 'urgent' || urgency === 'critical' ? 'animate-pulse' : ''
        }`}
        aria-hidden
      />
      {showLabel && (
        <span
          className={`uppercase tracking-wider font-bold opacity-80 ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          Time left
        </span>
      )}
      <span className={`font-bold ${compact ? '' : 'text-base'}`}>{label}</span>
    </div>
  );
}
