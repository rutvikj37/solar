import React, { useMemo, useState } from 'react';

const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * Follow Ups board for Lead 360 — persists via follow_up_at / next_action / notes.
 */
export default function LeadFollowUpsPanel({
  lead,
  followUpAt,
  nextAction,
  onFollowUpAtChange,
  onNextActionChange,
  onSave,
  busy = false,
  priority: priorityProp,
  onPriorityChange,
}) {
  const [title, setTitle] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [priority, setPriority] = useState(priorityProp || 'Medium');
  const [status, setStatus] = useState('Open');

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const followTs = lead?.follow_up_at ? new Date(lead.follow_up_at).getTime() : null;
  const isCompleted = !lead?.follow_up_at && Boolean(lead?.next_action?.startsWith('[Done]'));

  const summary = useMemo(() => {
    const dueToday = followTs != null && followTs >= startOfToday.getTime() && followTs <= endOfToday.getTime();
    const thisWeek = followTs != null && followTs > endOfToday.getTime() && followTs <= endOfWeek.getTime();
    const upcoming = followTs != null && followTs > endOfWeek.getTime();
    const overdue = followTs != null && followTs < startOfToday.getTime();
    return {
      dueToday: dueToday || overdue ? 1 : 0,
      thisWeek: thisWeek ? 1 : 0,
      upcoming: upcoming ? 1 : 0,
      completed: isCompleted ? 1 : 0,
    };
  }, [followTs, isCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = [];
  if (lead?.follow_up_at || lead?.next_action) {
    const metaMatch = String(lead.next_action || '').match(/^\[(High|Medium|Low)\]\s*(.*)$/i);
    const rowPriority = metaMatch ? metaMatch[1] : 'Medium';
    const rowTitle = metaMatch ? metaMatch[2] : lead.next_action || 'Follow up';
    rows.push({
      id: 'current',
      title: rowTitle,
      due: lead.follow_up_at,
      related: lead.owner_name || lead.address || 'This lead',
      priority: rowPriority,
      status: lead.follow_up_at && new Date(lead.follow_up_at).getTime() < now ? 'Overdue' : 'Open',
      createdBy: 'You',
    });
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = title.trim() || 'Follow up';
    const due = dueLocal || followUpAt;
    if (!due) {
      alert('Pick a due date');
      return;
    }
    onNextActionChange(`[${priority}] ${t}`);
    onFollowUpAtChange(due);
    if (onPriorityChange) onPriorityChange(priority);
    await onSave({
      nextAction: `[${priority}] ${t}`,
      followUpAt: due,
    });
    setTitle('');
    setDueLocal('');
    setStatus('Open');
  };

  const handleComplete = async () => {
    const doneTitle = (lead?.next_action || 'Follow up').replace(/^\[(High|Medium|Low)\]\s*/i, '');
    await onSave({
      nextAction: `[Done] ${doneTitle}`,
      followUpAt: '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Due Today', value: summary.dueToday, color: 'text-amber-300' },
          { label: 'This Week', value: summary.thisWeek, color: 'text-sky-300' },
          { label: 'Upcoming', value: summary.upcoming, color: 'text-white' },
          { label: 'Completed', value: summary.completed, color: 'text-emerald-300' },
        ].map((k) => (
          <div key={k.label} className="glass-card rounded-xl border border-glass-stroke p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{k.label}</p>
            <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl border border-glass-stroke p-5">
        <h3 className="text-sm font-bold text-white mb-3">Create Follow Up</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 sm:col-span-2">
            Title
            <input
              className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call homeowner / send proposal reminder"
              required
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Due
            <input
              type="datetime-local"
              className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
              value={dueLocal || followUpAt}
              onChange={(e) => setDueLocal(e.target.value)}
              required
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Priority
            <select
              className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save Follow Up'}
            </button>
            {lead?.follow_up_at && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={busy}
                className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
              >
                Mark completed
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="glass-card rounded-xl border border-glass-stroke overflow-hidden">
        <div className="px-5 py-3 border-b border-glass-stroke">
          <h3 className="text-sm font-bold text-white">Follow Ups</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Related</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created By</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[11px] text-on-surface-variant">
                    No follow-ups yet. Create one above.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="text-xs">
                  <td className="px-4 py-3 text-white font-semibold">{r.title}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {r.due ? new Date(r.due).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 truncate max-w-[160px]">{r.related}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.priority === 'High'
                          ? 'text-red-300 border-red-500/30 bg-red-500/10'
                          : r.priority === 'Low'
                            ? 'text-slate-300 border-glass-stroke bg-white/5'
                            : 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                      }`}
                    >
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.status}</td>
                  <td className="px-4 py-3 text-slate-400">{r.createdBy}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={handleComplete}
                      className="text-primary font-bold text-[11px] hover:underline"
                    >
                      Complete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
