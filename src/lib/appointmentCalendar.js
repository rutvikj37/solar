/**
 * Client-side ICS + calendar link helpers for Appointments UI.
 * Mirrors server/utils/appointmentCalendar.js (no shared package).
 */

export const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toIcsUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function appointmentWindow(appt) {
  const start = new Date(appt.scheduled_at || appt.scheduledAt);
  const minutes = Number(appt.duration_minutes || appt.durationMinutes || 60) || 60;
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start, end, minutes };
}

function descriptionLines(appt) {
  const parts = [];
  if (appt.owner_name) parts.push(`Lead: ${appt.owner_name}`);
  if (appt.address) parts.push(`Address: ${appt.address}`);
  if (appt.phone) parts.push(`Phone: ${appt.phone}`);
  if (appt.email) parts.push(`Email: ${appt.email}`);
  if (appt.notes) parts.push(`Notes: ${appt.notes}`);
  return parts.join('\n');
}

export function buildAppointmentIcs(appt) {
  const { start, end } = appointmentWindow(appt);
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  if (!dtStart || !dtEnd) throw new Error('Invalid appointment time');

  const uid = `appointment-${appt.id || 'new'}@spacetoroof`;
  const summary = escapeIcsText(appt.title || 'Appointment');
  const location = escapeIcsText(appt.location || appt.address || '');
  const description = escapeIcsText(descriptionLines(appt));
  const stamp = toIcsUtc(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpaceToRoof//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : null,
    description ? `DESCRIPTION:${description}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .filter((line) => line !== null)
    .join('\r\n');
}

export function buildGoogleCalendarUrl(appt) {
  const { start, end } = appointmentWindow(appt);
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  if (!dtStart || !dtEnd) return null;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appt.title || 'Appointment',
    dates: `${dtStart}/${dtEnd}`,
    details: descriptionLines(appt),
    location: appt.location || appt.address || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(appt) {
  const { start, end } = appointmentWindow(appt);
  if (Number.isNaN(start.getTime())) return null;

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: appt.title || 'Appointment',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: descriptionLines(appt),
    location: appt.location || appt.address || '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function getAppointmentBucket(appt, now = Date.now()) {
  const status = String(appt.status || 'scheduled').toLowerCase();
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'completed';
  if (status === 'no_show') return 'no_show';
  const when = new Date(appt.scheduled_at || appt.scheduledAt).getTime();
  if (Number.isNaN(when)) return 'scheduled';
  if (when < now) return 'past_due';
  return 'upcoming';
}

export function inferAppointmentType(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('consult')) return 'Consultation';
  if (t.includes('install')) return 'Install Check';
  return 'Site Survey';
}

export function statusBadgeClass(statusOrBucket) {
  const s = String(statusOrBucket || 'scheduled').toLowerCase();
  if (s === 'cancelled') return 'text-red-300 border-red-500/30 bg-red-500/10';
  if (s === 'completed') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (s === 'no_show') return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
  if (s === 'past_due') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-primary border-primary/30 bg-primary/10';
}

export function statusLabel(statusOrBucket) {
  const s = String(statusOrBucket || 'scheduled').toLowerCase();
  if (s === 'no_show') return 'No-show';
  if (s === 'past_due') return 'Past due';
  return s.replace(/_/g, ' ');
}

/** Trigger a browser download of an .ics file. */
export function downloadAppointmentIcs(appt) {
  const ics = buildAppointmentIcs(appt);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = String(appt.title || 'appointment')
    .replace(/[^\w\-]+/g, '-')
    .slice(0, 40);
  a.href = url;
  a.download = `${safeTitle || 'appointment'}-${appt.id || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
