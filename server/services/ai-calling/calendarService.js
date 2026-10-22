/**
 * Calendar Service — Google Calendar, Outlook, and internal appointment booking.
 * Handles agency routing by ZIP/state coverage.
 */
import db from '../../db.js';
import { getCalendarAccessToken, listCalendarConnections } from '../calendar/calendarConnections.js';

/**
 * Book an internal appointment (inserts into existing `appointments` table).
 */
export async function bookInternalAppointment(userId, leadId, { title, scheduledAt, durationMinutes, location, notes }) {
  const [result] = await db.query(
    `INSERT INTO appointments (user_id, lead_id, title, scheduled_at, duration_minutes, location, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    [userId, leadId, title || 'AI-Booked Solar Consultation', scheduledAt, durationMinutes || 30, location || '', notes || 'Booked automatically by AI Calling system']
  );
  return result.insertId;
}

function parseCalendarToken(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed?.access_token || parsed?.accessToken || (typeof parsed === 'string' ? parsed : null);
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}

/**
 * Load calendar tokens from ai_calling_settings for a user.
 */
export async function getUserCalendarTokens(userId) {
  const [rows] = await db.query(
    `SELECT google_calendar_token, outlook_calendar_token, default_timezone
     FROM ai_calling_settings WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const tokens = rows.length
    ? {
        google: parseCalendarToken(rows[0].google_calendar_token),
        outlook: parseCalendarToken(rows[0].outlook_calendar_token),
        timezone: rows[0].default_timezone || 'America/New_York',
      }
    : { google: null, outlook: null, timezone: 'America/New_York' };

  // OAuth connections from Integrations (auto-refreshing) win over legacy pasted tokens.
  try {
    const connections = await listCalendarConnections(userId);
    for (const conn of connections) {
      try {
        const token = await getCalendarAccessToken(conn);
        if (token) tokens[conn.provider] = token;
      } catch (err) {
        console.warn(`[Calendar] ${conn.provider} token unavailable for user ${userId}:`, err.message);
      }
    }
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') console.warn('[Calendar] connection lookup failed:', err.message);
  }
  return tokens;
}

const GOOGLE_EVENTS_URL = (calendarId = 'primary') =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
const CALENDAR_FETCH_TIMEOUT_MS = 10_000;

function eventEnd(event) {
  return new Date(new Date(event.startTime).getTime() + (event.durationMinutes || 30) * 60000);
}

function googleEventBody(event, { conference = true } = {}) {
  return {
    summary: event.title || 'Solar Consultation',
    description: event.description || '',
    location: event.location || '',
    start: { dateTime: new Date(event.startTime).toISOString(), timeZone: event.timezone || 'America/New_York' },
    end: { dateTime: eventEnd(event).toISOString(), timeZone: event.timezone || 'America/New_York' },
    ...(event.attendees ? { attendees: event.attendees } : {}),
    ...(conference
      ? {
          conferenceData: {
            createRequest: { requestId: `solar-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
          },
        }
      : {}),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };
}

// Graph takes a naive local time + zone; send UTC explicitly so the instant is exact.
function outlookEventBody(event, { onlineMeeting = true } = {}) {
  const naive = (d) => d.toISOString().replace(/\.\d{3}Z$/, '');
  return {
    subject: event.title || 'Solar Consultation',
    body: { contentType: 'text', content: event.description || '' },
    start: { dateTime: naive(new Date(event.startTime)), timeZone: 'UTC' },
    end: { dateTime: naive(eventEnd(event)), timeZone: 'UTC' },
    location: event.location ? { displayName: event.location } : undefined,
    ...(event.attendees
      ? {
          attendees: event.attendees.map((a) => ({
            emailAddress: { address: a.email, name: a.displayName || a.email },
            type: 'required',
          })),
        }
      : {}),
    ...(onlineMeeting ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' } : {}),
  };
}

/**
 * Book a Google Calendar event (with optional Meet link + attendees).
 * opts: { conference = true, sendUpdates = 'all', calendarId = 'primary' }
 */
export async function bookGoogleCalendarEvent(accessToken, event, opts = {}) {
  if (!accessToken) return { eventId: null, simulated: true };
  const { conference = true, sendUpdates = 'all', calendarId = 'primary' } = opts;

  const response = await fetch(
    `${GOOGLE_EVENTS_URL(calendarId)}?conferenceDataVersion=${conference ? 1 : 0}&sendUpdates=${sendUpdates}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEventBody(event, { conference })),
      signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    console.error('[Google Calendar] Failed to create event:', response.status);
    return { eventId: null, simulated: false, error: 'Failed to create event', status: response.status };
  }

  const data = await response.json();
  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    data.htmlLink ||
    null;
  return { eventId: data.id, htmlLink: data.htmlLink, meetLink, simulated: false };
}

/** PATCH an existing Google event. Returns { ok, status } (404/410 = event gone). */
export async function updateGoogleCalendarEvent(accessToken, eventId, event, opts = {}) {
  const { sendUpdates = 'none', calendarId = 'primary' } = opts;
  const body = googleEventBody(event, { conference: false });
  const response = await fetch(
    `${GOOGLE_EVENTS_URL(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
    }
  );
  if (!response.ok) console.error('[Google Calendar] Failed to update event:', response.status);
  return { ok: response.ok, status: response.status };
}

export async function deleteGoogleCalendarEvent(accessToken, eventId, opts = {}) {
  const { sendUpdates = 'none', calendarId = 'primary' } = opts;
  const response = await fetch(
    `${GOOGLE_EVENTS_URL(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
    }
  );
  const gone = response.status === 404 || response.status === 410;
  if (!response.ok && !gone) console.error('[Google Calendar] Failed to delete event:', response.status);
  return { ok: response.ok || gone, status: response.status };
}

/**
 * Book an Outlook Calendar event (Microsoft Graph API).
 * opts: { onlineMeeting = true }
 */
export async function bookOutlookEvent(accessToken, event, opts = {}) {
  if (!accessToken) return { eventId: null, simulated: true };
  const { onlineMeeting = true } = opts;

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(outlookEventBody(event, { onlineMeeting })),
    signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error('[Outlook] Failed to create event:', response.status);
    return { eventId: null, simulated: false, status: response.status };
  }

  const data = await response.json();
  return {
    eventId: data.id,
    meetLink: data.onlineMeeting?.joinUrl || data.webLink || null,
    simulated: false,
  };
}

export async function updateOutlookEvent(accessToken, eventId, event) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(outlookEventBody(event, { onlineMeeting: false })),
    signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) console.error('[Outlook] Failed to update event:', response.status);
  return { ok: response.ok, status: response.status };
}

export async function deleteOutlookEvent(accessToken, eventId) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS),
  });
  const gone = response.status === 404 || response.status === 410;
  if (!response.ok && !gone) console.error('[Outlook] Failed to delete event:', response.status);
  return { ok: response.ok || gone, status: response.status };
}

/**
 * Route a lead to the correct solar agency based on ZIP/state coverage.
 */
export async function routeToAgency(userId, leadZip, leadState) {
  const [agencies] = await db.query(
    'SELECT * FROM ai_solar_agencies WHERE user_id = ? AND is_active = 1',
    [userId]
  );

  for (const agency of agencies) {
    const zipCodes = typeof agency.zip_codes === 'string' ? JSON.parse(agency.zip_codes) : agency.zip_codes;
    const states = typeof agency.states === 'string' ? JSON.parse(agency.states) : agency.states;

    if (Array.isArray(zipCodes) && leadZip && zipCodes.includes(String(leadZip))) return agency;
    if (Array.isArray(states) && leadState && states.includes(String(leadState).toUpperCase())) return agency;
  }

  return agencies.length > 0 ? agencies[0] : null;
}

/**
 * Find available appointment slots for a given date (internal calendar + optional agency).
 */
export async function findAvailableSlots(userId, date, durationMinutes = 30) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const [existing] = await db.query(
    `SELECT scheduled_at, duration_minutes FROM appointments
     WHERE user_id = ? AND DATE(scheduled_at) = ? AND status != 'cancelled'
     ORDER BY scheduled_at`,
    [userId, dateStr]
  );

  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let min = 0; min < 60; min += durationMinutes) {
      const slotTime = `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
      const slotStart = new Date(slotTime).getTime();
      const slotEnd = slotStart + durationMinutes * 60000;

      const conflict = existing.some((appt) => {
        const apptStart = new Date(appt.scheduled_at).getTime();
        const apptEnd = apptStart + (appt.duration_minutes || 30) * 60000;
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      if (!conflict) {
        slots.push({ time: slotTime, available: true });
      }
    }
  }

  return slots;
}

/**
 * Full booking pipeline: internal + agency routing + Google/Outlook sync.
 */
export async function bookAppointmentWithIntegrations({
  userId,
  leadId,
  scheduledAt,
  durationMinutes = 30,
  title,
  notes,
  lead,
}) {
  const agency = await routeToAgency(userId, lead?.zip, lead?.state);
  const location = agency?.calendar_link || agency?.name || '';
  const appointmentId = await bookInternalAppointment(userId, leadId, {
    title: title || 'AI-Booked Solar Consultation',
    scheduledAt,
    durationMinutes,
    location,
    notes: [
      notes || '',
      agency ? `Assigned agency: ${agency.name}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  });

  const tokens = await getUserCalendarTokens(userId);
  const attendees = [];
  if (lead?.email) attendees.push({ email: lead.email, displayName: lead.owner_name || lead.email });
  if (agency?.email) attendees.push({ email: agency.email, displayName: agency.name });

  const eventPayload = {
    title: title || `Solar Consultation — ${lead?.owner_name || 'Homeowner'}`,
    description: `${notes || 'AI-booked solar consultation'}\nAgency: ${agency?.name || 'Unassigned'}\nAddress: ${lead?.address || 'N/A'}`,
    startTime: scheduledAt.replace(' ', 'T'),
    durationMinutes,
    timezone: tokens.timezone,
    location: agency?.calendar_link || lead?.address || '',
    attendees,
  };

  let googleEventId = null;
  let outlookEventId = null;
  let inviteLink = agency?.calendar_link || null;

  if (tokens.google) {
    const g = await bookGoogleCalendarEvent(tokens.google, eventPayload);
    googleEventId = g.eventId || null;
    if (g.meetLink) inviteLink = g.meetLink;
    else if (g.htmlLink) inviteLink = g.htmlLink;
  }

  if (tokens.outlook) {
    const o = await bookOutlookEvent(tokens.outlook, eventPayload);
    outlookEventId = o.eventId || null;
    if (o.meetLink) inviteLink = o.meetLink;
  }

  if (googleEventId || outlookEventId) {
    await db
      .query(
        `UPDATE appointments SET google_event_id = ?, outlook_event_id = ?, calendar_sync_status = 'synced',
           calendar_sync_error = NULL, calendar_synced_at = NOW() WHERE id = ?`,
        [googleEventId, outlookEventId, appointmentId]
      )
      .catch((err) => console.warn('[Calendar] could not store event ids:', err.message));
  }

  return {
    appointmentId,
    agency,
    googleEventId,
    outlookEventId,
    inviteLink,
  };
}
