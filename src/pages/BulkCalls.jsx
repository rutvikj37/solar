import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const API = API_BASE;

export default function BulkCalls() {
  const [leads, setLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState(
    'Hi! This is your local solar team. Based on your roof, you may qualify for significant energy savings. Reply YES for a free assessment.'
  );
  const [channel, setChannel] = useState('sms');
  const [results, setResults] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setLeads(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [navigate]);

  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const send = async () => {
    const token = localStorage.getItem('solar_token');
    if (!token || selectedIds.length === 0) return;
    setSending(true);
    setResults(null);
    try {
      if (channel === 'sms') {
        const res = await fetch(`${API}/api/outreach/bulk-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadIds: selectedIds, message })
        });
        const data = await res.json();
        setResults(data.results || []);
      } else {
        const out = [];
        for (const leadId of selectedIds) {
          const res = await fetch(`${API}/api/outreach/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ leadId, message, subject: 'Your solar savings estimate' })
          });
          const data = await res.json();
          out.push({ leadId, status: res.ok ? data.status : 'error', error: data.error });
        }
        setResults(out);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl font-bold text-primary">Bulk Outreach</h2>
        <p className="text-on-surface-variant text-sm mt-1">SMS or email sequences across selected unlocked leads.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter text-xs">
        <div className="glass-card rounded-xl p-6 space-y-4 lg:col-span-1">
          <div className="flex gap-2">
            {['sms', 'email'].map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`flex-1 py-2 rounded-lg font-bold uppercase text-[10px] ${
                  channel === c ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[140px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-on-surface-variant">{selectedIds.length} leads selected</p>
          <button
            onClick={send}
            disabled={sending || selectedIds.length === 0}
            className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-bold disabled:opacity-50"
          >
            {sending ? 'Sending...' : `Send ${channel.toUpperCase()}`}
          </button>
          {results && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {results.map((r) => (
                <p key={r.leadId} className="text-[10px] text-on-surface-variant">
                  Lead {r.leadId}: <span className="text-white">{r.status}</span>
                  {r.error ? ` (${r.error})` : ''}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Lead</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Phone</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/lead/${l.id}`} className="text-white font-semibold hover:text-primary">
                      {l.owner_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-on-surface-variant">{l.phone || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{l.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
