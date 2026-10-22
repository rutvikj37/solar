import { useEffect, useState } from 'react';
import { API_BASE } from '../config.js';
import { authHeaders, getToken } from './auth.js';

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const TASKS_CHANGED_EVENT = 'crm-tasks-changed';

export const PRIORITY_STYLES = {
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  high: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  normal: 'bg-primary/10 text-primary border-primary/30',
  low: 'bg-surface-container text-on-surface-variant border-outline-variant',
};

const tzOffset = () => new Date().getTimezoneOffset();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/tasks${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function notifyChanged() {
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
}

export function fetchTasks({ scope = 'mine', status = 'open', leadId } = {}) {
  const q = new URLSearchParams({ scope, status, tzOffset: String(tzOffset()) });
  if (leadId) q.set('leadId', String(leadId));
  return request(`?${q}`);
}

export function fetchTaskSummary(scope = 'mine') {
  return request(`/summary?scope=${scope}&tzOffset=${tzOffset()}`);
}

export function fetchTaskAssignees() {
  return request('/assignees');
}

export async function createTask(body) {
  const data = await request('', { method: 'POST', body: JSON.stringify(body) });
  notifyChanged();
  return data.task;
}

export async function updateTask(id, body) {
  const data = await request(`/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  notifyChanged();
  return data.task;
}

export async function deleteTask(id) {
  await request(`/${id}`, { method: 'DELETE' });
  notifyChanged();
}

/** `datetime-local` input value <-> ISO string. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDue(iso) {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Overdue/today counts + lead ids with overdue tasks; refreshes on task changes and every 2 minutes. */
export function useTaskSummary(scope = 'mine') {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!getToken()) return undefined;
    let cancelled = false;
    const load = () =>
      fetchTaskSummary(scope)
        .then((s) => !cancelled && setSummary(s))
        .catch(() => {});
    load();
    const timer = setInterval(load, 120000);
    window.addEventListener(TASKS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(TASKS_CHANGED_EVENT, load);
    };
  }, [scope]);
  return summary;
}
