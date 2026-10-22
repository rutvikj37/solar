import React, { useCallback, useEffect, useState } from 'react';
import { fetchTasks } from '../../lib/tasks.js';
import { TaskQuickAdd, TaskRow } from './TaskItems.jsx';

/** Follow-up tasks for a single lead (open first, recent completed collapsed). */
export default function LeadTasksPanel({ leadId, onChanged }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTasks({ leadId, status: 'all' });
      setTasks(data.tasks || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status !== 'open');
  const overdue = open.filter((t) => t.isOverdue).length;

  return (
    <div className="crm-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <span className="material-symbols-outlined text-base text-primary">task_alt</span>
          Tasks
          {open.length > 0 && <span className="text-xs font-semibold text-on-surface-variant">({open.length} open)</span>}
        </h3>
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[12px]">alarm</span>
            {overdue} overdue
          </span>
        )}
      </div>

      <TaskQuickAdd leadId={leadId} onCreated={changed} />

      {loading && <p className="text-xs text-on-surface-variant">Loading tasks…</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && open.length === 0 && (
        <p className="text-xs text-on-surface-variant">No open follow-ups for this lead.</p>
      )}
      <div className="space-y-2">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} showLead={false} onChanged={changed} />
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
          >
            {showDone ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} showLead={false} onChanged={changed} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
