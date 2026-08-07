import React from 'react';
import DripStatsBar from './DripStatsBar';

export default function DripCampaignList({
  campaigns,
  selectedId,
  onSelect,
  onToggleStatus,
  onDelete,
}) {
  if (!campaigns.length) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center space-y-3 border border-glass-stroke">
        <span className="material-symbols-outlined text-4xl text-slate-500">campaign</span>
        <h3 className="text-white font-bold text-base">No Drip Campaigns</h3>
        <p className="text-slate-400 max-w-sm mx-auto text-xs">
          Create an automated SMS → Email nurture sequence. Messages send automatically every minute during business hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`w-full text-left glass-card rounded-2xl p-4 border transition-colors ${
            selectedId === c.id ? 'border-primary/50 bg-primary/5' : 'border-glass-stroke hover:border-white/20'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">reorder</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{c.name}</h3>
                <p className="text-[10px] text-slate-400">
                  {c.enrollmentMode?.replace('_', ' ')} · min score {c.triggerMinScore} · {c.steps?.length || 0} steps
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  c.status === 'active'
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                }`}
              >
                {c.status}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleStatus(c.id, c.status); }}
                className="px-2 py-1 rounded-lg bg-white/5 text-xs text-white hover:bg-white/10"
              >
                {c.status === 'active' ? 'Pause' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
          {selectedId === c.id && c.stats && (
            <div className="mt-4 pt-4 border-t border-glass-stroke/50">
              <DripStatsBar stats={c.stats} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
