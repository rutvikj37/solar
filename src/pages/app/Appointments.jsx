import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PlanUpgradeGate from '../../components/PlanUpgradeGate.jsx';
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadAppointmentIcs,
  getAppointmentBucket,
  inferAppointmentType,
  statusBadgeClass,
  statusLabel,
} from '../../lib/appointmentCalendar.js';

const API = API_BASE;

const EMPTY_FORM = {
  title: 'Site Survey',
  leadId: '',
  scheduledAt: '',
  durationMinutes: 60,
  location: '',
  notes: '',
  type: 'Site Survey',
  sendConfirmation: true,
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'past_due', label: 'Past due' },
  { id: 'completed', label: 'Completed' },
  { id: 'no_show', label: 'No-show' },
  { id: 'cancelled', label: 'Cancelled' },
];

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function weekDaysFrom(anchor = new Date()) {
  const start = startOfDay(anchor);
  const day = start.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function CalendarActions({ appt, token, compact = false }) {
  const google = buildGoogleCalendarUrl(appt);
  const outlook = buildOutlookCalendarUrl(appt);

  const downloadServerIcs = async () => {
    try {
      const res = await fetch(`${API}/api/appointments/${appt.id}/ics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('ICS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointment-${appt.id}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      downloadAppointmentIcs(appt);
    }
  };

  const btn =
    compact
      ? 'text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/8 text-on-surface-variant hover:text-on-surface hover:bg-white/12'
      : 'text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-on-surface hover:bg-white/15';

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" onClick={downloadServerIcs} className={btn} title="Download .ics">
        ICS
      </button>
      {google && (
        <a href={google} target="_blank" rel="noopener noreferrer" className={btn}>
          Google
        </a>
      )}
      {outlook && (
        <a href={outlook} target="_blank" rel="noopener noreferrer" className={btn}>
          Outlook
        </a>
      )}
    </div>
  );
}

export default function Appointments() {
  const { can, entitlements } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('upcoming');
  const [viewMode, setViewMode] = useState('list');
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay());
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [busyId, setBusyId] = useState(null);
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

  const now = Date.now();
  const todayStart = startOfDay().getTime();
  const todayEnd = endOfDay().getTime();

  const kpis = useMemo(() => {
    const active = appointments.filter((a) => {
      const s = String(a.status || 'scheduled').toLowerCase();
      return s === 'scheduled';
    });
    const today = active.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      return t >= todayStart && t <= todayEnd;
    }).length;
    const endWeek = new Date(todayStart);
    endWeek.setDate(endWeek.getDate() + 7);
    const thisWeek = active.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      return t >= todayStart && t <= endWeek.getTime();
    }).length;
    const pastDue = active.filter((a) => new Date(a.scheduled_at).getTime() < now).length;
    const noShow = appointments.filter((a) => String(a.status).toLowerCase() === 'no_show').length;
    return { today, thisWeek, pastDue, noShow };
  }, [appointments, now, todayStart, todayEnd]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const bucket = getAppointmentBucket(a, now);
      const t = new Date(a.scheduled_at).getTime();
      if (filter === 'all') return true;
      if (filter === 'today') {
        return (
          String(a.status || 'scheduled').toLowerCase() === 'scheduled' &&
          t >= todayStart &&
          t <= todayEnd
        );
      }
      if (filter === 'upcoming') return bucket === 'upcoming';
      if (filter === 'past_due') return bucket === 'past_due';
      if (filter === 'completed') return bucket === 'completed';
      if (filter === 'no_show') return bucket === 'no_show';
      if (filter === 'cancelled') return bucket === 'cancelled';
      return true;
    });
  }, [appointments, filter, now, todayStart, todayEnd]);

  const weekDays = useMemo(() => weekDaysFrom(weekAnchor), [weekAnchor]);

  const weekAppointments = useMemo(() => {
    const weekStart = weekDays[0];
    const weekEnd = endOfDay(weekDays[6]);
    return appointments.filter((a) => {
      const s = String(a.status || 'scheduled').toLowerCase();
      if (s === 'cancelled') return false;
      const t = new Date(a.scheduled_at);
      return t >= weekStart && t <= weekEnd;
    });
  }, [appointments, weekDays]);

  const patchAppointment = async (id, body) => {
    const t = token();
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      await load();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t || !form.scheduledAt) return;
    setSaving(true);
    try {
      const lead = form.leadId ? leads.find((l) => String(l.id) === String(form.leadId)) : null;
      const res = await fetch(`${API}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          title: form.title,
          leadId: form.leadId ? Number(form.leadId) : null,
          scheduledAt: form.scheduledAt,
          durationMinutes: Number(form.durationMinutes) || 60,
          location: form.location || lead?.address || '',
          notes: form.notes,
          sendConfirmation: form.sendConfirmation,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const created = await res.json();
      if (created.emailSent) {
        alert('Appointment booked. Confirmation email sent (with calendar links).');
      } else if (form.sendConfirmation && form.leadId && created.emailSkippedReason === 'no_email') {
        alert('Appointment booked. Lead has no email — confirmation skipped.');
      } else if (form.sendConfirmation && created.emailSkippedReason === 'send_failed') {
        alert('Appointment booked, but confirmation email failed. You can resend from the list.');
      }
      setForm(EMPTY_FORM);
      setShowModal(false);
      setFilter('upcoming');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    await patchAppointment(id, { status: 'cancelled' });
  };

  const handleReschedule = async (id) => {
    if (!rescheduleAt) return alert('Pick a new date/time');
    const ok = await patchAppointment(id, {
      scheduledAt: rescheduleAt,
      status: 'scheduled',
      sendConfirmation: true,
    });
    if (ok) {
      setRescheduleId(null);
      setRescheduleAt('');
    }
  };

  const handleResend = async (appt) => {
    if (!appt.email) return alert('Lead has no email address');
    const t = token();
    setBusyId(appt.id);
    try {
      const res = await fetch(`${API}/api/appointments/${appt.id}/resend-confirmation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      alert('Confirmation email resent with calendar links.');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openCreateForLead = (leadId) => {
    const lead = leads.find((l) => String(l.id) === String(leadId));
    setForm({
      ...EMPTY_FORM,
      leadId: leadId ? String(leadId) : '',
      location: lead?.address || '',
      title: lead ? `Site Survey — ${lead.owner_name || 'Lead'}` : 'Site Survey',
    });
    setShowModal(true);
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

  const renderStatus = (a) => {
    const bucket = getAppointmentBucket(a, now);
    const label = bucket === 'past_due' ? 'Past due' : statusLabel(a.status || 'scheduled');
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadgeClass(
          bucket === 'past_due' ? 'past_due' : a.status
        )}`}
      >
        {label}
      </span>
    );
  };

  const renderRowActions = (a) => {
    const status = String(a.status || 'scheduled').toLowerCase();
    const busy = busyId === a.id;
    if (status === 'cancelled') {
      return <span className="text-[10px] text-slate-500">—</span>;
    }
    return (
      <div className="flex flex-col items-end gap-1.5">
        <CalendarActions appt={a} token={token()} compact />
        <div className="flex flex-wrap justify-end gap-1">
          {status === 'scheduled' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => patchAppointment(a.id, { status: 'completed' })}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300"
              >
                Complete
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => patchAppointment(a.id, { status: 'no_show' })}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500/15 text-orange-300"
              >
                No-show
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRescheduleId(a.id);
                  setRescheduleAt(
                    a.scheduled_at ? new Date(a.scheduled_at).toISOString().slice(0, 16) : ''
                  );
                }}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-on-surface"
              >
                Reschedule
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleCancel(a.id)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-300"
              >
                Cancel
              </button>
            </>
          )}
          {(status === 'completed' || status === 'no_show') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patchAppointment(a.id, { status: 'scheduled' })}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-on-surface"
            >
              Reopen
            </button>
          )}
          {a.email && status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleResend(a)}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/15 text-primary"
            >
              Resend email
            </button>
          )}
        </div>
        {rescheduleId === a.id && (
          <div className="flex flex-col sm:flex-row gap-1.5 items-end pt-1">
            <input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
              className="bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-on-surface text-[11px]"
            />
            <button
              type="button"
              onClick={() => handleReschedule(a.id)}
              disabled={busy}
              className="bg-primary text-on-primary px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setRescheduleId(null)}
              className="text-[10px] text-on-surface-variant px-2 py-1.5"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mb-stack-lg flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-on-surface">Appointments</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Schedule site surveys, track outcomes, and add visits to your calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY_FORM);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create New Appointment
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">today</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">Today</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.today}</p>
        </div>
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">date_range</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">This week</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.thisWeek}</p>
        </div>
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">Past due</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.pastDue}</p>
          <button
            type="button"
            onClick={() => {
              setFilter('past_due');
              setViewMode('list');
            }}
            className="text-[10px] text-amber-300 font-bold mt-1 hover:underline"
          >
            Review →
          </button>
        </div>
        <div className="crm-kpi p-4">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined">person_off</span>
          </div>
          <p className="text-[11px] font-semibold text-on-surface-variant">No-shows</p>
          <p className="text-2xl font-black text-on-surface mt-1">{kpis.noShow}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setViewMode('list');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                filter === f.id && viewMode === 'list'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-glass-stroke text-on-surface-variant hover:text-on-surface bg-white/[0.03]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-glass-stroke p-0.5 bg-white/[0.03] self-start">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
              viewMode === 'list' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
              viewMode === 'week' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="crm-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-glass-stroke flex items-center justify-between gap-3">
            <h3 className="font-bold text-on-surface text-sm">Week agenda</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(weekAnchor);
                  d.setDate(d.getDate() - 7);
                  setWeekAnchor(startOfDay(d));
                }}
                className="p-1.5 rounded-lg bg-white/10 text-on-surface"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(startOfDay())}
                className="text-[11px] font-bold text-primary px-2"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(weekAnchor);
                  d.setDate(d.getDate() + 7);
                  setWeekAnchor(startOfDay(d));
                }}
                className="p-1.5 rounded-lg bg-white/10 text-on-surface"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-glass-stroke/60 min-h-[280px]">
            {weekDays.map((day) => {
              const items = weekAppointments.filter((a) => sameDay(new Date(a.scheduled_at), day));
              const isToday = sameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`p-3 ${isToday ? 'bg-primary/5' : ''}`}>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-sm font-black mb-2 ${isToday ? 'text-primary' : 'text-on-surface'}`}>
                    {day.getDate()}
                  </p>
                  <div className="space-y-1.5">
                    {items.length === 0 && (
                      <p className="text-[10px] text-on-surface-variant/70">—</p>
                    )}
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-glass-stroke bg-white/[0.04] p-2 space-y-1"
                      >
                        <p className="text-[10px] font-bold text-primary">
                          {new Date(a.scheduled_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-[11px] font-semibold text-on-surface leading-snug line-clamp-2">
                          {a.title}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {a.owner_name || 'Unlinked'}
                        </p>
                        {renderStatus(a)}
                        <CalendarActions appt={a} token={token()} compact />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="crm-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-glass-stroke flex items-center justify-between gap-3">
            <h3 className="font-bold text-on-surface text-sm">
              {FILTERS.find((f) => f.id === filter)?.label || 'Appointments'}
            </h3>
            <p className="text-[11px] text-on-surface-variant">{filtered.length} shown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[980px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Lead / Customer</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke/60">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-on-surface-variant">
                      No appointments in this view.{' '}
                      <button
                        type="button"
                        onClick={() => openCreateForLead('')}
                        className="text-primary font-bold hover:underline"
                      >
                        Create one
                      </button>
                    </td>
                  </tr>
                )}
                {filtered.map((a) => (
                  <tr key={a.id} className="text-xs hover:bg-white/[0.03] align-top">
                    <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                      {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : '—'}
                      <span className="block text-[10px] text-slate-500">
                        {a.duration_minutes || 60} min
                        {a.location ? ` · ${a.location}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface font-semibold truncate max-w-[180px]">
                        {a.owner_name || '—'}
                      </p>
                      {a.address && (
                        <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{a.address}</p>
                      )}
                      {a.lead_id && (
                        <Link
                          to={`/lead/${a.lead_id}`}
                          className="text-primary text-[10px] font-bold hover:underline"
                        >
                          View lead
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface font-semibold">{a.title}</td>
                    <td className="px-4 py-3 text-slate-300">{inferAppointmentType(a.title)}</td>
                    <td className="px-4 py-3">{renderStatus(a)}</td>
                    <td className="px-4 py-3 text-right">{renderRowActions(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  onChange={(e) => {
                    const lead = leads.find((l) => String(l.id) === e.target.value);
                    setForm({
                      ...form,
                      leadId: e.target.value,
                      location: form.location || lead?.address || '',
                    });
                  }}
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
                  <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">
                    Duration (min)
                  </label>
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
                        title:
                          form.title === EMPTY_FORM.title || !form.title || form.title === form.type
                            ? e.target.value
                            : form.title,
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
              <label className="flex items-center gap-2 text-[11px] text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sendConfirmation}
                  onChange={(e) => setForm({ ...form, sendConfirmation: e.target.checked })}
                  className="rounded border-glass-stroke"
                />
                Send confirmation email with calendar links (when lead has email)
              </label>
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
