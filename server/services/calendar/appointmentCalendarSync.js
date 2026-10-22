/**
 * Mirror CRM appointments into the owner's connected Google / Outlook calendars.
 * Events go only to the rep's own calendar (no attendees, no provider invites); homeowner
 * confirmations stay on the existing email path.
 */
import db from '../../db.js';
import {
  bookGoogleCalendarEvent,
  bookOutlookEvent,
  deleteGoogleCalendarEvent,
  deleteOutlookEvent,
  updateGoogleCalendarEvent,
  updateOutlookEvent,
} from '../ai-calling/calendarService.js';
import {
  CalendarAuthError,
  getCalendarAccessToken,
  listCalendarConnections,
  markCalendarConnection,
} from './calendarConnections.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';

const SYNC_BUDGET_MS = Number(process.env.CALENDAR_SYNC_BUDGET_MS) || 6000;
const EVENT_COLUMN = { google: 'google_event_id', outlook: 'outlook_event_id' };

function frontendBase() {
  return resolveFrontendBaseUrl();
}

function buildEvent(appt) {
  const lines = [
    appt.owner_name ? `Homeowner: ${appt.owner_name}` : null,
    appt.phone ? `Phone: ${appt.phone}` : null,
    appt.email ? `Email: ${appt.email}` : null,
    appt.address ? `Address: ${appt.address}` : null,
    appt.notes ? `\nNotes: ${appt.notes}` : null,
    appt.lead_id && frontendBase() ? `\nLead: ${frontendBase()}/lead/${appt.lead_id}` : null,
  ].filter(Boolean);
  return {
    title: appt.title || 'Solar appointment',
    description: lines.join('\n'),
    location: appt.location || appt.address || '',
    startTime: new Date(appt.scheduled_at).toISOString(),
    durationMinutes: Number(appt.duration_minutes) || 60,
    timezone: 'UTC',
  };
}

async function syncProvider(conn, appt, shouldExist) {
  const provider = conn.provider;
  const eventId = appt[EVENT_COLUMN[provider]] || null;
  if (!shouldExist && !eventId) return { provider, ok: true, eventId: null, action: 'none' };

  let token;
  try {
    token = await getCalendarAccessToken(conn);
  } catch (err) {
    const needsReconnect = err instanceof CalendarAuthError;
    await markCalendarConnection(conn.user_id, provider, {
      status: needsReconnect ? 'needs_reconnect' : 'error',
      error: err.message,
    });
    return { provider, ok: false, eventId, error: needsReconnect ? 'Reconnect calendar in Integrations' : err.message };
  }

  const event = buildEvent(appt);
  const calendarId = conn.calendar_id || 'primary';
  let result;
  if (!shouldExist) {
    const r =
      provider === 'google'
        ? await deleteGoogleCalendarEvent(token, eventId, { calendarId })
        : await deleteOutlookEvent(token, eventId);
    result = { ok: r.ok, status: r.status, eventId: r.ok ? null : eventId, action: 'delete' };
  } else if (eventId) {
    const r =
      provider === 'google'
        ? await updateGoogleCalendarEvent(token, eventId, event, { calendarId })
        : await updateOutlookEvent(token, eventId, event);
    result = { ok: r.ok, status: r.status, eventId, action: 'update' };
    if (r.status === 404 || r.status === 410) result = null;
  }
  if (shouldExist && !result) {
    const r =
      provider === 'google'
        ? await bookGoogleCalendarEvent(token, event, { conference: false, sendUpdates: 'none', calendarId })
        : await bookOutlookEvent(token, event, { onlineMeeting: false });
    result = { ok: Boolean(r.eventId), status: r.status, eventId: r.eventId || null, action: 'create' };
  }

  if (result.status === 401 || result.status === 403) {
    await markCalendarConnection(conn.user_id, provider, {
      status: 'needs_reconnect',
      error: `Calendar API returned ${result.status}`,
    });
    return { provider, ok: false, eventId: result.eventId ?? eventId, error: 'Reconnect calendar in Integrations' };
  }
  await markCalendarConnection(conn.user_id, provider, {
    status: result.ok ? 'ok' : 'error',
    error: result.ok ? null : `Calendar API returned ${result.status}`,
    synced: result.ok,
  });
  return {
    provider,
    ok: result.ok,
    eventId: result.eventId,
    action: result.action,
    ...(result.ok ? {} : { error: `Calendar API returned ${result.status}` }),
  };
}

/**
 * @param appt appointments row (joined with lead owner_name/address/phone/email)
 * @param action 'upsert' | 'delete' (delete = row already removed; only clean up events)
 */
export async function syncAppointmentCalendars(appt, { action = 'upsert' } = {}) {
  if (!appt?.user_id) return { status: 'skipped', providers: [] };
  let connections = [];
  try {
    connections = await listCalendarConnections(appt.user_id);
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return { status: 'not_connected', providers: [] };
    throw err;
  }
  if (!connections.length) return { status: 'not_connected', providers: [] };

  const shouldExist = action !== 'delete' && String(appt.status || '').toLowerCase() !== 'cancelled';
  const providers = [];
  for (const conn of connections) {
    try {
      providers.push(await syncProvider(conn, appt, shouldExist));
    } catch (err) {
      providers.push({ provider: conn.provider, ok: false, eventId: appt[EVENT_COLUMN[conn.provider]] || null, error: err.message });
    }
  }

  const okCount = providers.filter((p) => p.ok).length;
  const status = okCount === providers.length ? 'synced' : okCount ? 'partial' : 'error';
  const error = providers.filter((p) => !p.ok).map((p) => `${p.provider}: ${p.error}`).join('; ') || null;

  if (action !== 'delete') {
    const sets = ['calendar_sync_status = ?', 'calendar_sync_error = ?', 'calendar_synced_at = NOW()'];
    const params = [status, error ? error.slice(0, 500) : null];
    for (const p of providers) {
      sets.push(`${EVENT_COLUMN[p.provider]} = ?`);
      params.push(p.eventId);
    }
    await db.query(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`, [...params, appt.id]);
  }
  return { status, error, providers: providers.map(({ provider, ok, action: a, error: e }) => ({ provider, ok, action: a, error: e })) };
}

/** Run sync but don't hold the HTTP response longer than the budget; finishes in background. */
export async function syncAppointmentCalendarsWithin(appt, opts) {
  const run = syncAppointmentCalendars(appt, opts).catch((err) => {
    console.warn('[Calendar] appointment sync failed:', err.message);
    return { status: 'error', error: err.message, providers: [] };
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ status: 'pending', providers: [] }), SYNC_BUDGET_MS));
  return Promise.race([run, timeout]);
}
