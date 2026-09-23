import React from 'react';

export default function DripStatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Sent', value: stats.sent, icon: 'send', color: 'text-emerald-400' },
    { label: 'Simulated', value: stats.simulated, icon: 'science', color: 'text-violet-400' },
    { label: 'Failed', value: stats.failed, icon: 'error', color: 'text-red-400' },
    { label: 'Skipped', value: stats.skipped, icon: 'skip_next', color: 'text-amber-400' },
    { label: 'Active', value: stats.activeEnrollments, icon: 'group', color: 'text-sky-400' },
    { label: 'Completed', value: stats.completedEnrollments, icon: 'check_circle', color: 'text-green-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <div key={item.label} className="p-3 rounded-xl bg-surface-container-low border border-glass-stroke">
          <div className="flex items-center gap-2 mb-1">
            <span className={`material-symbols-outlined text-sm ${item.color}`}>{item.icon}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{item.label}</span>
          </div>
          <p className="text-xl font-bold text-on-surface">{item.value ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
