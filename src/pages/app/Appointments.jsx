import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PlanUpgradeGate from '../../components/PlanUpgradeGate.jsx';

const API = API_BASE;

const EMPTY_FORM = {
  title: 'Site Survey',
  leadId: '',
  scheduledAt: '',
  durationMinutes: 60,
  location: '',
  notes: '',
  type: 'Site Survey',
};

export default function Appointments() {
  const { can, entitlements } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
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
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
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

  const kpis = useMemo(() => {
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setHours(23, 59, 59, 999);
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);

    const active = appointments.filter((a) => a.status === 'scheduled');
    const today = active.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      return t >= startToday.getTime() && t <= endToday.getTime();
    }).length;
    const thisWeek = active.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      return t > endToday.getTime() && t <= endWeek.getTime();
    }).length;
    const upcoming = active.filter((a) => new Date(a.scheduled_at).getTime() > endWeek.getTime()).length;
    return { today, thisWeek, upcoming };
  }, [appointments]);

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
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const created = await res.json();
      if (created.emailSent) {
        alert('Appointment booked. Confirmation email sent to the lead.');
      }
      setForm(EMPTY_FORM);
      setShowModal(false);
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
    const res = await fetch(`${API}/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) {
      await fetch(`${API}/api/appointments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      });
    }
    await load();
  };

  if (!can('appointments')) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PlanUpgradeGate
          title="Appointments require Mission Control"
          message={`Your current plan (${entitlements?.packageName || 'Free'}) does not include the Appointment setter. Upgrade to Mission Control to schedule site surveys and follow-ups.`}
          feature="appointments"
          packageName={entitlements?.packageName}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-stack-lg flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-on-surface">Appointments</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage and track all your scheduled appointments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create New Appointment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">today</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">Today&apos;s Appointments</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.today}</p>
          <p className="text-[11px] text-on-surface-variant mt-1">{kpis.today} upcoming today</p>
        </div>
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">date_range</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">This Week</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.thisWeek}</p>
          <p className="text-[11px] text-on-surface-variant mt-1">Scheduled this week</p>
        </div>
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">event_upcoming</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">Upcoming</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.upcoming}</p>
          <p className="text-[11px] text-on-surface-variant mt-1">Beyond this week</p>
        </div>
      </div>

      <div className="crm-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-glass-stroke flex items-center justify-between gap-3">
          <h3 className="font-bold text-on-surface text-sm">All Appointments</h3>
          <p className="text-[11px] text-on-surface-variant">{appointments.length} total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Lead / Customer</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke/60">
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-on-surface-variant">
                    No appointments yet. Create one to book a site survey.
                  </td>
                </tr>
              )}
              {appointments.map((a) => (
                <tr key={a.id} className="text-xs hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                    {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : '—'}
                    <span className="block text-[10px] text-slate-500">{a.duration_minutes || 60} min</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-on-surface font-semibold truncate max-w-[180px]">
                      {a.owner_name || '—'}
                    </p>
                    {a.address && (
                      <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{a.address}</p>
                    )}
                    {a.lead_id && (
                      <Link to={`/lead/${a.lead_id}`} className="text-primary text-[10px] font-bold hover:underline">
                        View lead
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface font-semibold">{a.title}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {a.title?.toLowerCase().includes('consult')
                      ? 'Consultation'
                      : a.title?.toLowerCase().includes('install')
                        ? 'Install'
                        : 'Site Survey'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        a.status === 'cancelled'
                          ? 'text-red-300 border-red-500/30 bg-red-500/10'
                          : a.status === 'completed'
                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-primary border-primary/30 bg-primary/10'
                      }`}
                    >
                      {a.status || 'scheduled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">You</td>
                  <td className="px-4 py-3 text-right">
                    {a.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(a.id)}
                        className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-card rounded-2xl border border-glass-stroke p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-on-surface">Create New Appointment</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Title</label>
                <input
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Lead</label>
                <select
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
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
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Duration (min)</label>
                  <input
                    type="number"
                    className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Type</label>
                  <select
                    className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value,
                        title: form.title === EMPTY_FORM.title || !form.title ? e.target.value : form.title,
                      })
                    }
                  >
                    <option>Site Survey</option>
                    <option>Consultation</option>
                    <option>Install Check</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Location</label>
                <input
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Property address"
                />
              </div>
              <div>
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Notes</label>
                <textarea
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface min-h-[80px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/10 text-on-surface py-2.5 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
