import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const API = API_BASE;

export default function CallCenter() {
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [script, setScript] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = () => localStorage.getItem('solar_token');

  const load = async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    try {
      const [lRes, cRes] = await Promise.all([
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/outreach/calls`, { headers: { Authorization: `Bearer ${t}` } })
      ]);
      if (lRes.ok) setLeads(await lRes.json());
      if (cRes.ok) setCalls(await cRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [navigate]);

  useEffect(() => {
    const t = token();
    if (!selectedLead || !t) return;
    fetch(`${API}/api/outreach/script/${selectedLead}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((r) => r.json())
      .then((d) => setScript(d.script || ''))
      .catch(() => {});
  }, [selectedLead]);

  const scheduleCall = async () => {
    const t = token();
    if (!selectedLead || !scheduledAt) return alert('Select a lead and time');
    const res = await fetch(`${API}/api/outreach/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ leadId: Number(selectedLead), scheduledAt, script })
    });
    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || 'Failed');
    }
    setScheduledAt('');
    await load();
  };

  const completeCall = async (id) => {
    const t = token();
    const res = await fetch(`${API}/api/outreach/calls/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ status: 'completed', notes })
    });
    if (res.ok) {
      setNotes('');
      await load();
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
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">AI Call Center</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Generate solar scripts, schedule outbound calls, and capture AI summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter text-xs">
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-white text-sm">Prepare Call</h3>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Lead</label>
            <select
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
            >
              <option value="">Select lead...</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.owner_name || 'Lead'} · {l.phone || 'no phone'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Script</label>
            <textarea
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[120px]"
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Schedule At</label>
            <input
              type="datetime-local"
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <button
            onClick={scheduleCall}
            className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-bold hover:opacity-90"
          >
            Schedule Call
          </button>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-glass-stroke flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">Scheduled Calls</h3>
            <Link to="/scheduled-calls" className="text-primary text-[10px] font-bold uppercase hover:underline">
              Full queue
            </Link>
          </div>
          <div className="divide-y divide-glass-stroke max-h-[480px] overflow-y-auto">
            {calls.length === 0 && (
              <p className="p-6 text-on-surface-variant">No scheduled calls yet.</p>
            )}
            {calls.map((c) => (
              <div key={c.id} className="p-5 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{c.owner_name}</p>
                    <p className="text-on-surface-variant">{c.phone} · {new Date(c.scheduled_at).toLocaleString()}</p>
                  </div>
                  <span className="px-2 py-0.5 h-fit rounded bg-white/5 text-[9px] font-bold uppercase text-on-surface-variant">
                    {c.status}
                  </span>
                </div>
                {c.summary && <p className="text-on-surface-variant italic">{c.summary}</p>}
                {c.status === 'scheduled' && (
                  <div className="space-y-2">
                    <textarea
                      placeholder="Call notes for AI summary..."
                      className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[60px]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <button
                      onClick={() => completeCall(c.id)}
                      className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase"
                    >
                      Complete + Summarize
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
