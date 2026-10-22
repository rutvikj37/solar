import React, { useCallback, useEffect, useState } from 'react';
import { fetchTasks, TASKS_CHANGED_EVENT } from '../../lib/tasks.js';
import { TaskQuickAdd, TaskRow } from '../../components/tasks/TaskItems.jsx';

const SECTIONS = [
  { key: 'overdue', label: 'Overdue', icon: 'alarm', accent: 'text-red-600 dark:text-red-400' },
  { key: 'today', label: 'Today', icon: 'today', accent: 'text-primary' },
  { key: 'upcoming', label: 'Upcoming', icon: 'event_upcoming', accent: 'text-on-surface' },
  { key: 'noDate', label: 'No due date', icon: 'inventory_2', accent: 'text-on-surface-variant' },
];

/** Task queue: open follow-ups bucketed into Overdue / Today / Upcoming. */
export default function Tasks() {
  const [scope, setScope] = useState('mine');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('open');

  const load = useCallback(async () => {
    try {
      const res = await fetchTasks({ scope, status: view === 'open' ? 'open' : 'done' });
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [scope, view]);

  useEffect(() => {
    load();
    window.addEventListener(TASKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, load);
  }, [load]);

  const buckets = data?.buckets || {};
  const tabBtn = (active) =>
    `rounded-lg px-3 py-1.5 text-xs font-bold border ${
      active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
    }`;

  return (
    <>
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          <span className="material-symbols-outlined text-sm">task_alt</span>
          Follow-ups
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">Tasks</h1>
        <p className="text-xs text-on-surface-variant max-w-2xl">
          Calls, visits and follow-ups across your leads. Overdue tasks are flagged here, on the lead and in the sidebar.
        </p>
      </div>

      <div className="crm-panel p-4 mb-4">
        <TaskQuickAdd />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button type="button" className={tabBtn(view === 'open')} onClick={() => setView('open')}>
          Open
        </button>
        <button type="button" className={tabBtn(view === 'done')} onClick={() => setView('done')}>
          Completed
        </button>
        {data?.canSeeAll && (
          <>
            <span className="mx-1 h-4 w-px bg-outline-variant" />
            <button type="button" className={tabBtn(scope === 'mine')} onClick={() => setScope('mine')}>
              My tasks
            </button>
            <button type="button" className={tabBtn(scope === 'all')} onClick={() => setScope('all')}>
              Whole team
            </button>
          </>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="text-xs text-on-surface-variant">Loading tasks…</p>}

      {data && view === 'open' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {SECTIONS.map((s) => {
            const list = buckets[s.key] || [];
            if (s.key === 'noDate' && list.length === 0) return null;
            return (
              <section key={s.key} className="crm-panel p-4 space-y-2">
                <h2 className={`flex items-center gap-2 text-sm font-bold ${s.accent}`}>
                  <span className="material-symbols-outlined text-base">{s.icon}</span>
                  {s.label}
                  <span className="text-xs font-semibold text-on-surface-variant">({list.length})</span>
                </h2>
                {list.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">
                    {s.key === 'overdue' ? 'Nothing overdue. Nice.' : 'Nothing here.'}
                  </p>
                ) : (
                  list.map((t) => <TaskRow key={t.id} task={t} />)
                )}
              </section>
            );
          })}
        </div>
      )}

      {data && view === 'done' && (
        <section className="crm-panel p-4 space-y-2">
          {data.tasks.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No completed tasks yet.</p>
          ) : (
            data.tasks.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </section>
      )}
    </>
  );
}
