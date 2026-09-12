import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config.js';

import ApiErrorBanner from '../../components/layout/ApiErrorBanner.jsx';

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('billing');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json'
  });

  const load = async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      setLoadError('');
      const res = await fetch(`${API_BASE}/api/tickets/mine`, { headers: headers() });
      if (!res.ok) throw new Error('Failed to load tickets');
      setTickets(await res.json());
    } catch (err) {
      setLoadError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [navigate]);

  const createTicket = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ subject, body, category })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setSubject('');
      setBody('');
      navigate(`/support/${data.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <ApiErrorBanner error={loadError} onRetry={load} />
      <div className="mb-6">
        <h2 className="font-headline-lg text-2xl font-bold text-primary">Support</h2>
        <p className="text-on-surface-variant text-sm mt-1">Open a ticket for billing, credits, data quality, or technical issues.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <form onSubmit={createTicket} className="glass-card p-6 rounded-xl space-y-3">
          <h3 className="text-on-surface font-bold text-sm">New Ticket</h3>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
          >
            <option value="billing">Billing / Credits</option>
            <option value="data">Lead Data Quality</option>
            <option value="technical">Technical</option>
            <option value="general">General</option>
          </select>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
          />
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe your issue…"
            rows={5}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
          />
          <button
            disabled={creating}
            type="submit"
            className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {creating ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>

        <div className="glass-card rounded-xl divide-y divide-glass-stroke">
          <div className="px-4 py-3 text-on-surface font-bold text-sm">My Tickets</div>
          {loading && <p className="p-4 text-on-surface-variant">Loading…</p>}
          {!loading && tickets.length === 0 && (
            <p className="p-4 text-on-surface-variant">No tickets yet.</p>
          )}
          {tickets.map((t) => (
            <Link key={t.id} to={`/support/${t.id}`} className="block px-4 py-3 hover:bg-white/5">
              <p className="text-on-surface font-semibold">{t.subject}</p>
              <p className="text-on-surface-variant mt-1">
                #{t.id} · {t.status} · {new Date(t.updated_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
