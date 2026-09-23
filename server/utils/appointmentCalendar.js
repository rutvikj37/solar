/**
 * ICS + "Add to calendar" helpers for CRM appointments.
 * Kept separate from AI-calling calendar OAuth sync.
 */

export const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];

export function isValidAppointmentStatus(status) {
  return APPOINTMENT_STATUSES.includes(String(status || '').toLowerCase());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Format a Date as UTC ICS timestamp: YYYYMMDDTHHMMSSZ */
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

/**
 * Build a standards-friendly VCALENDAR string for one appointment.
 */
export function buildAppointmentIcs(appt, { prodId = '-//SpaceToRoof//Appointments//EN' } = {}) {
  const { start, end } = appointmentWindow(appt);
  const dtStart = toIcsUtc(start);
  const dtEnd = toIcsUtc(end);
  if (!dtStart || !dtEnd) {
    throw new Error('Invalid appointment time');
  }

  const uid = `appointment-${appt.id || 'new'}@spacetoroof`;
  const summary = escapeIcsText(appt.title || 'Appointment');
  const location = escapeIcsText(appt.location || appt.address || '');
  const description = escapeIcsText(descriptionLines(appt));
  const stamp = toIcsUtc(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
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

/** Google Calendar "template" deep link (opens event composer). */
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

/** Outlook.com compose deep link. */
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

export function buildCalendarLinks(appt) {
  return {
    google: buildGoogleCalendarUrl(appt),
    outlook: buildOutlookCalendarUrl(appt),
  };
}

/** Derive display bucket for list filtering (past_due is virtual). */
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
