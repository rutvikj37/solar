import React from 'react';

export default function DripFunnelChart({ funnel }) {
  if (!funnel) return null;

  const maxVal = Math.max(funnel.enrolled || 1, ...(funnel.steps || []).map((s) => s.sent || 0));

  return (
    <div className="space-y-4 p-4 rounded-xl bg-surface-container-low border border-glass-stroke">
      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Campaign Funnel</h4>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{funnel.enrolled}</p>
          <p className="text-[10px] text-slate-400 uppercase">Enrolled</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-primary">{funnel.replied}</p>
          <p className="text-[10px] text-slate-400 uppercase">Replied</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-400">{funnel.converted}</p>
          <p className="text-[10px] text-slate-400 uppercase">Converted</p>
        </div>
      </div>
      <div className="space-y-2">
        {(funnel.steps || []).map((step) => (
          <div key={step.stepOrder} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">
                Step {step.stepOrder} · {step.actionType?.toUpperCase()}
              </span>
              <span className="text-white font-bold">{step.sent} sent</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.round(((step.sent || 0) / maxVal) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
