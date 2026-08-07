import React from 'react';
import { Link } from 'react-router-dom';

export default function DripEnrollmentTable({ enrollments, onCancel, loading }) {
  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        <span className="material-symbols-outlined animate-spin">sync</span>
        Loading enrollments...
      </div>
    );
  }

  if (!enrollments?.length) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-glass-stroke rounded-xl">
        No enrollments yet. Matching leads are auto-enrolled when the campaign is active.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-glass-stroke">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-white/5 text-slate-400 text-[10px] uppercase">
            <th className="text-left p-3 font-bold">Lead</th>
            <th className="text-left p-3 font-bold">Step</th>
            <th className="text-left p-3 font-bold">Next Run</th>
            <th className="text-left p-3 font-bold">Status</th>
            <th className="text-right p-3 font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.id} className="border-t border-glass-stroke/50 hover:bg-white/[0.02]">
              <td className="p-3">
                <Link to={`/leads/${e.leadId}`} className="text-white font-semibold hover:text-primary">
                  {e.ownerName || 'Unknown'}
                </Link>
                <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{e.address}</p>
              </td>
              <td className="p-3 text-slate-300">Step {e.currentStep}</td>
              <td className="p-3 text-slate-400 font-mono text-[10px]">
                {e.nextRunAt ? new Date(e.nextRunAt).toLocaleString() : '—'}
              </td>
              <td className="p-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  e.status === 'active' ? 'bg-sky-500/15 text-sky-400' :
                  e.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {e.status}
                </span>
              </td>
              <td className="p-3 text-right">
                {e.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => onCancel(e.id)}
                    className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold"
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
