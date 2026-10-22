import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PRIORITY_STYLES,
  TASK_PRIORITIES,
  createTask,
  deleteTask,
  fetchTaskAssignees,
  formatDue,
  fromLocalInput,
  updateTask,
} from '../../lib/tasks.js';

let assigneesPromise = null;
function loadAssignees() {
  if (!assigneesPromise) {
    assigneesPromise = fetchTaskAssignees().catch((err) => {
      assigneesPromise = null;
      throw err;
    });
  }
  return assigneesPromise;
}

export function TaskRow({ task, showLead = true, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = task.status === 'done';

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
        task.isOverdue ? 'border-red-500/40 bg-red-500/5' : 'border-outline-variant bg-surface'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => updateTask(task.id, { status: done ? 'open' : 'done' }))}
        className={`mt-0.5 shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
          done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-outline-variant hover:border-primary'
        }`}
        aria-label={done ? 'Reopen task' : 'Mark task done'}
        title={done ? 'Reopen' : 'Mark done'}
      >
        {done && <span className="material-symbols-outlined text-[12px] leading-none">check</span>}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold ${done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-on-surface-variant">
          <span
            className={`inline-flex items-center gap-0.5 ${
              task.isOverdue ? 'font-bold text-red-600 dark:text-red-400' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">{task.isOverdue ? 'alarm' : 'schedule'}</span>
            {task.isOverdue ? `Overdue · ${formatDue(task.dueAt)}` : formatDue(task.dueAt)}
          </span>
          <span className={`rounded border px-1.5 py-px font-bold uppercase ${PRIORITY_STYLES[task.priority] || ''}`}>
            {task.priority}
          </span>
          {task.assigneeName && <span>→ {task.assigneeName}</span>}
          {showLead && task.leadId && (
            <Link to={`/lead/${task.leadId}`} className="truncate text-primary hover:underline max-w-[220px]">
              {task.leadName && task.leadName !== 'Not Available' ? task.leadName : task.leadAddress || `Lead #${task.leadId}`}
            </Link>
          )}
        </div>
        {task.notes && <p className="mt-1 text-[11px] text-on-surface-variant whitespace-pre-line">{task.notes}</p>}
        {error && <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm('Delete this task?')) run(() => deleteTask(task.id));
        }}
        className="shrink-0 text-on-surface-variant hover:text-red-500"
        aria-label="Delete task"
        title="Delete"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
      </button>
    </div>
  );
}

export function TaskQuickAdd({ leadId = null, onCreated, compact = false }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignee, setAssignee] = useState('');
  const [assignees, setAssignees] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadAssignees()
      .then((data) => {
        if (cancelled) return;
        setAssignees(data.users || []);
        setAssignee(String(data.me ?? ''));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createTask({
        title: title.trim(),
        leadId: leadId || undefined,
        dueAt: fromLocalInput(due),
        priority,
        ...(assignee ? { assigneeUserId: Number(assignee) } : {}),
      });
      setTitle('');
      setDue('');
      setPriority('normal');
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary';

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'items-center'}`}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={leadId ? 'Add a follow-up (e.g. Call back about quote)' : 'New task'}
          maxLength={255}
          className={`${field} flex-1 min-w-[180px]`}
        />
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={field}
          aria-label="Due date"
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field} aria-label="Priority">
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        {assignees && assignees.length > 1 && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field} aria-label="Assignee">
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">add_task</span>
          {busy ? 'Adding…' : 'Add task'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
