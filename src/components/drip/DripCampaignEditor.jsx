import React from 'react';

const ENROLLMENT_MODES = [
  { value: 'score_gated', label: 'Score-gated auto-enroll' },
  { value: 'all_leads', label: 'All leads auto-enroll' },
  { value: 'manual', label: 'Manual enrollment only' },
];

export default function DripCampaignEditor({ form, onChange }) {
  const set = (field, value) => onChange({ ...form, [field]: value });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-slate-400 uppercase font-bold">Campaign Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-xl px-3 py-2.5 text-sm text-white"
          placeholder="e.g. High-Score Solar Nurture"
        />
      </div>

      <div>
        <label className="text-[10px] text-slate-400 uppercase font-bold">Description</label>
        <textarea
          rows={2}
          value={form.description || ''}
          onChange={(e) => set('description', e.target.value)}
          className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-xl px-3 py-2.5 text-xs text-white resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-slate-400 uppercase font-bold">Min Lead Score</label>
          <input
            type="number"
            min="0"
            max="100"
            value={form.triggerMinScore ?? 70}
            onChange={(e) => set('triggerMinScore', Number(e.target.value))}
            className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-xl px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 uppercase font-bold">Enrollment Mode</label>
          <select
            value={form.enrollmentMode || 'score_gated'}
            onChange={(e) => set('enrollmentMode', e.target.value)}
            className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-xl px-3 py-2.5 text-sm text-white"
          >
            {ENROLLMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-glass-stroke space-y-3">
        <p className="text-xs font-bold text-white">Timing & Compliance</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold">Timezone</label>
            <input
              type="text"
              value={form.timezone || 'America/New_York'}
              onChange={(e) => set('timezone', e.target.value)}
              className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold">Quiet Start</label>
            <input
              type="time"
              value={(form.quietHoursStart || '09:00:00').slice(0, 5)}
              onChange={(e) => set('quietHoursStart', `${e.target.value}:00`)}
              className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold">Quiet End</label>
            <input
              type="time"
              value={(form.quietHoursEnd || '20:00:00').slice(0, 5)}
              onChange={(e) => set('quietHoursEnd', `${e.target.value}:00`)}
              className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.stopOnReply !== false}
            onChange={(e) => set('stopOnReply', e.target.checked)}
            className="rounded"
          />
          Stop sequence when lead replies via SMS
        </label>
      </div>
    </div>
  );
}
