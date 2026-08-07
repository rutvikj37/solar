import React from 'react';
import { getLeadInitials, getScoreTier } from '../../lib/leads.js';

export default function LeadAvatar({ name, score, size = 'md' }) {
  const tier = getScoreTier(score);
  const dim = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-xs';

  return (
    <div
      className={`${dim} rounded-xl border flex items-center justify-center font-bold shrink-0 ${tier.className}`}
      title={name || 'Lead'}
    >
      {getLeadInitials(name)}
    </div>
  );
}
