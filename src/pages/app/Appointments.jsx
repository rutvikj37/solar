import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: 'Site Survey',
    leadId: '',
    scheduledAt: '',
    durationMinutes: 60,
    location: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const token = () => localStorage.getItem('solar_token');

  const load = async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    try {
      const [aRes, lRes] = await Promise.all([
        fetch(`${API}/api/appointments`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } })
      ]);
      if (aRes.ok) setAppointments(await aRes.json());
      if (lRes.ok) setLeads(await lRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t || !form.scheduledAt) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          title: form.title,
          leadId: form.leadId ? Number(form.leadId) : null,
          scheduledAt: form.scheduledAt,
          durationMinutes: Number(form.durationMinutes) || 60,
          location: form.location,
          notes: form.notes
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      setForm({ title: 'Site Survey', leadId: '', scheduledAt: '', durationMinutes: 60, location: '', notes: '' });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    const t = token();
    if (!window.confirm('Cancel this appointment?')) return;
    await fetch(`${API}/api/appointments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` }
    });
    await load();
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">Appointments</h2>
        <p className="text-on-surface-variant text-sm mt-1">Book site surveys and track visits from unlocked leads.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <form onSubmit={handleCreate} className="glass-card rounded-xl p-6 space-y-4 text-xs lg:col-span-1">
          <h3 className="font-bold text-white text-sm">Schedule Appointment</h3>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Title</label>
            <input
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Lead</label>
            <select
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={form.leadId}
              onChange={(e) => setForm({ ...form, leadId: e.target.value })}
            >
              <option value="">No linked lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.owner_name || 'Lead'} — {l.address?.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">When</label>
            <input
              type="datetime-local"
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Duration (min)</label>
            <input
              type="number"
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Location</label>
            <input
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Property address"
            />
          </div>
          <div>
            <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Notes</label>
            <textarea
              className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Book Appointment'}
          </button>
        </form>

        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-glass-stroke">
            <h3 className="font-bold text-white text-sm">Upcoming & Recent</h3>
          </div>
          <div className="divide-y divide-glass-stroke">
            {appointments.length === 0 && (
              <p className="p-6 text-xs text-on-surface-variant">No appointments yet. Book a site survey from a lead.</p>
            )}
            {appointments.map((a) => (
              <div key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-white">{a.title}</p>
                  <p className="text-on-surface-variant mt-1">
                    {new Date(a.scheduled_at).toLocaleString()} · {a.duration_minutes} min
                  </p>
                  <p className="text-on-surface-variant mt-0.5">
                    {a.owner_name || '—'} {a.address ? `· ${a.address}` : ''}
                  </p>
                  {a.lead_id && (
                    <Link to={`/lead/${a.lead_id}`} className="text-primary hover:underline mt-1 inline-block">
                      View lead
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                    {a.status}
                  </span>
                  <button
                    onClick={() => handleCancel(a.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
