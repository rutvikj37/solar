import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const API = API_BASE;

export default function ScheduledCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetch(`${API}/api/outreach/calls`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setCalls(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mb-stack-lg flex justify-between items-end gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl font-bold text-primary">Scheduled Calls</h2>
          <p className="text-on-surface-variant text-sm mt-1">Outbound call queue across your pipeline.</p>
        </div>
        <Link to="/call-center" className="text-xs font-bold text-primary hover:underline">
          Open Call Center
        </Link>
      </div>

      <section className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Lead</th>
              <th className="px-6 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Phone</th>
              <th className="px-6 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">When</th>
              <th className="px-6 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Status</th>
              <th className="px-6 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-stroke">
            {calls.map((c) => (
              <tr key={c.id} className="hover:bg-white/5">
                <td className="px-6 py-4">
                  <Link to={`/lead/${c.lead_id}`} className="text-white font-semibold hover:text-primary">
                    {c.owner_name}
                  </Link>
                  <p className="text-on-surface-variant mt-0.5">{c.address}</p>
                </td>
                <td className="px-6 py-4 font-mono text-on-surface-variant">{c.phone}</td>
                <td className="px-6 py-4 text-on-surface-variant">{new Date(c.scheduled_at).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-on-surface-variant max-w-xs truncate">{c.summary || '—'}</td>
              </tr>
            ))}
            {calls.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant">
                  No scheduled calls. Create one in the AI Call Center.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </AppLayout>
  );
}
