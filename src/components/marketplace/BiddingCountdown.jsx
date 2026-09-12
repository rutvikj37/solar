import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatCountdown, getCountdownUrgency } from '../../lib/marketplace.js';

const URGENCY_STYLES = {
  none: 'border-glass-stroke bg-surface-container text-on-surface-variant',
  closed: 'border-glass-stroke bg-surface-container-high text-on-surface-variant',
  normal: 'border-cyan-400/45 bg-cyan-500/12 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.12)]',
  urgent:
    'border-amber-400/55 bg-amber-500/18 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.15)] animate-pulse',
  critical:
    'border-red-400/60 bg-red-500/20 text-red-300 shadow-[0_0_20px_rgba(248,113,113,0.2)] animate-pulse',
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
