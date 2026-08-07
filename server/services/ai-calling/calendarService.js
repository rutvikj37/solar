/**
 * Calendar Service — Google Calendar, Outlook, and internal appointment booking.
 * Handles agency routing by ZIP/state coverage.
 */
import db from '../../db.js';

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
  if (!rows.length) return { google: null, outlook: null, timezone: 'America/New_York' };
  return {
    google: parseCalendarToken(rows[0].google_calendar_token),
    outlook: parseCalendarToken(rows[0].outlook_calendar_token),
    timezone: rows[0].default_timezone || 'America/New_York',
  };
}

/**
 * Book a Google Calendar event (with optional Meet link + attendees).
 */
export async function bookGoogleCalendarEvent(accessToken, event) {
  if (!accessToken) return { eventId: null, simulated: true };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title || 'Solar Consultation',
        description: event.description || '',
        location: event.location || '',
        start: {
          dateTime: new Date(event.startTime).toISOString(),
          timeZone: event.timezone || 'America/New_York',
        },
        end: {
          dateTime: new Date(new Date(event.startTime).getTime() + (event.durationMinutes || 30) * 60000).toISOString(),
          timeZone: event.timezone || 'America/New_York',
        },
        attendees: event.attendees || [],
        conferenceData: {
          createRequest: {
            requestId: `solar-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    console.error('[Google Calendar] Failed to create event:', response.status);
    return { eventId: null, simulated: false, error: 'Failed to create event' };
  }

  const data = await response.json();
  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    data.htmlLink ||
    null;
  return { eventId: data.id, htmlLink: data.htmlLink, meetLink, simulated: false };
}

/**
 * Book an Outlook Calendar event (Microsoft Graph API).
 */
export async function bookOutlookEvent(accessToken, event) {
  if (!accessToken) return { eventId: null, simulated: true };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: event.title || 'Solar Consultation',
      body: { contentType: 'text', content: event.description || '' },
      start: {
        dateTime: new Date(event.startTime).toISOString().replace(/\.\d{3}Z$/, ''),
        timeZone: event.timezone || 'America/New_York',
      },
      end: {
        dateTime: new Date(new Date(event.startTime).getTime() + (event.durationMinutes || 30) * 60000)
          .toISOString()
          .replace(/\.\d{3}Z$/, ''),
        timeZone: event.timezone || 'America/New_York',
      },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: (event.attendees || []).map((a) => ({
        emailAddress: { address: a.email, name: a.displayName || a.email },
        type: 'required',
      })),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    }),
  });

  if (!response.ok) {
    console.error('[Outlook] Failed to create event:', response.status);
    return { eventId: null, simulated: false };
  }

  const data = await response.json();
  return {
    eventId: data.id,
    meetLink: data.onlineMeeting?.joinUrl || data.webLink || null,
    simulated: false,
  };
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

  return {
    appointmentId,
    agency,
    googleEventId,
    outlookEventId,
    inviteLink,
  };
}
