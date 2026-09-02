import React, { useMemo, useState } from 'react';

const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * Follow Ups board for Lead 360 — driven by lead.follow_up_at / next_action.
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
  assigneeName = '',
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [priority, setPriority] = useState(priorityProp || 'Medium');

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
    const dueToday =
      followTs != null && followTs >= startOfToday.getTime() && followTs <= endOfToday.getTime();
    const thisWeek =
      followTs != null && followTs > endOfToday.getTime() && followTs <= endOfWeek.getTime();
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
  const relatedAssignee = (assigneeName && String(assigneeName).trim()) || '—';
  if (lead?.follow_up_at || (lead?.next_action && !String(lead.next_action).startsWith('[Done]'))) {
    const metaMatch = String(lead.next_action || '').match(/^\[(High|Medium|Low)\]\s*(.*)$/i);
    const rowPriority = metaMatch ? metaMatch[1] : 'Medium';
    const rowTitle = metaMatch ? metaMatch[2] : lead.next_action || 'Follow up';
    const overdue = lead.follow_up_at && new Date(lead.follow_up_at).getTime() < now;
    rows.push({
      id: 'current',
      title: rowTitle,
      due: lead.follow_up_at,
      relatedName: lead.owner_name || 'This lead',
      relatedAddress: lead.address || '',
      priority: rowPriority,
      status: overdue ? 'Pending' : 'Pending',
      createdBy: relatedAssignee,
    });
  }
  if (isCompleted) {
    const doneTitle = String(lead.next_action || '').replace(/^\[Done\]\s*/i, '') || 'Follow up';
    rows.push({
      id: 'done',
      title: doneTitle,
      due: null,
      relatedName: lead.owner_name || 'This lead',
      relatedAddress: lead.address || '',
      priority: 'Low',
      status: 'Completed',
      createdBy: relatedAssignee,
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
    setShowForm(false);
  };

  const handleComplete = async () => {
    const doneTitle = (lead?.next_action || 'Follow up').replace(/^\[(High|Medium|Low)\]\s*/i, '');
    await onSave({
      nextAction: `[Done] ${doneTitle}`,
      followUpAt: '',
    });
  };

  const kpis = [
    { label: 'Due Today', value: summary.dueToday, icon: 'schedule', tint: 'bg-primary/10 text-primary' },
    { label: 'Due This Week', value: summary.thisWeek, icon: 'calendar_month', tint: 'bg-orange-500/10 text-orange-400' },
    { label: 'Upcoming', value: summary.upcoming, icon: 'event_upcoming', tint: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Completed', value: summary.completed, icon: 'check_circle', tint: 'bg-slate-500/10 text-slate-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-on-surface">Follow Ups</h3>
          <p className="text-[12px] text-on-surface-variant mt-0.5">
            Track and manage all follow ups for this lead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2.5 rounded-lg text-xs font-bold"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create Follow Up
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="crm-kpi p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.tint}`}>
              <span className="material-symbols-outlined text-xl">{k.icon}</span>
            </div>
            <p className="text-[11px] font-semibold text-on-surface-variant">{k.label}</p>
            <p className="text-2xl font-black text-on-surface mt-1">
              {k.value} <span className="text-xs font-bold text-on-surface-variant">Follow ups</span>
            </p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="crm-panel p-5">
          <h4 className="text-sm font-bold text-on-surface mb-3">New Follow Up</h4>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[10px] uppercase tracking-wider text-on-surface-variant sm:col-span-2">
              Title
              <input
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Follow up on proposal"
                required
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Due Date & Time
              <input
                type="datetime-local"
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                value={dueLocal || followUpAt}
                onChange={(e) => setDueLocal(e.target.value)}
                required
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Priority
              <select
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
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
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save Follow Up'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg font-bold text-xs text-on-surface-variant"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="crm-panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-glass-stroke flex items-center justify-between">
          <h3 className="text-sm font-bold text-on-surface">All Follow Ups</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[780px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke bg-surface-container-low/40">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Due Date & Time</th>
                <th className="px-4 py-3">Related To</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-on-surface-variant">
                    No follow-ups yet. Create one to get started.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="text-xs">
                  <td className="px-4 py-3.5 font-bold text-on-surface">{r.title}</td>
                  <td className="px-4 py-3.5 text-on-surface-variant whitespace-nowrap">
                    {r.due ? (
                      <>
                        <span className="block text-on-surface font-semibold">
                          {new Date(r.due).toLocaleDateString()}
                        </span>
                        <span className="text-[11px]">{new Date(r.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-on-surface truncate max-w-[160px]">{r.relatedName}</p>
                    {r.relatedAddress ? (
                      <p className="text-[11px] text-on-surface-variant truncate max-w-[160px]">{r.relatedAddress}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.priority === 'High'
                          ? 'bg-red-500/15 text-red-400'
                          : r.priority === 'Low'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-orange-500/15 text-orange-400'
                      }`}
                    >
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'Completed'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-orange-500/15 text-orange-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                        YOU
                      </span>
                      <span className="text-on-surface-variant">{r.createdBy}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {r.status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={handleComplete}
                        className="text-primary font-bold text-[11px] hover:underline"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-glass-stroke text-[11px] text-on-surface-variant">
          Showing {rows.length} follow up{rows.length === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}
