import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticateToken, isAdminRole } from '../middleware/auth.js';
import {
  CALENDAR_PROVIDERS,
  calendarOAuthRedirect,
  completeCalendarOAuth,
  disconnectCalendar,
  getCalendarAuthorizeUrl,
  getCalendarStatus,
  isCalendarProviderConfigured,
} from '../services/calendar/calendarConnections.js';
import { syncAppointmentCalendars } from '../services/calendar/appointmentCalendarSync.js';
import { consumeEmailOAuthState, createEmailOAuthState } from '../services/email/userEmailConnections.js';

const router = express.Router();
const STATE_PREFIX = 'calendar_';

const resyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `calendar-resync:${req.user?.id || 'anon'}`,
  message: { error: 'Too many calendar sync requests. Try again in a few minutes.' },
});

function validProvider(req, res) {
  const provider = String(req.params.provider || '').toLowerCase();
  if (!CALENDAR_PROVIDERS.includes(provider)) {
    res.status(400).json({ error: 'Unknown calendar provider' });
    return null;
  }
  return provider;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    res.json(await getCalendarStatus(req.user.id, { includeMissingEnv: isAdminRole(req.user.role) }));
  } catch (err) {
    console.error('[Calendar] status failed:', err);
    res.status(500).json({ error: 'Failed to load calendar status' });
  }
});

router.get('/connect/:provider', authenticateToken, async (req, res) => {
  const provider = validProvider(req, res);
  if (!provider) return;
  try {
    if (!(await isCalendarProviderConfigured(provider))) {
      return res.status(503).json({
        error: `${provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'} sync is not configured on this server yet.`,
        code: 'CALENDAR_NOT_CONFIGURED',
      });
    }
    const state = await createEmailOAuthState(req.user.id, `${STATE_PREFIX}${provider}`, req.query.returnTo);
    res.json({ authorizeUrl: await getCalendarAuthorizeUrl(provider, state) });
  } catch (err) {
    console.error('[Calendar] connect failed:', err);
    res.status(500).json({ error: 'Failed to start calendar connection' });
  }
});

router.get('/callback/:provider', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const { code, state, error: oauthError } = req.query;
  if (!CALENDAR_PROVIDERS.includes(provider)) return res.redirect(calendarOAuthRedirect({ calendar_error: 'Unknown provider' }));
  if (oauthError) return res.redirect(calendarOAuthRedirect({ calendar_error: String(oauthError) }));
  if (!code || !state) return res.redirect(calendarOAuthRedirect({ calendar_error: 'Missing OAuth code or state' }));
  let row = null;
  try {
    row = await consumeEmailOAuthState(String(state));
    if (!row || row.provider !== `${STATE_PREFIX}${provider}`) {
      return res.redirect(calendarOAuthRedirect({ calendar_error: 'Invalid or expired OAuth state' }, row?.return_to));
    }
    await completeCalendarOAuth(provider, row.user_id, String(code));
    res.redirect(calendarOAuthRedirect({ calendar: `${provider}_connected` }, row.return_to));
  } catch (err) {
    console.error('[Calendar] OAuth callback failed:', err.message);
    res.redirect(calendarOAuthRedirect({ calendar_error: err.message || 'Calendar connection failed' }, row?.return_to));
  }
});

router.delete('/:provider', authenticateToken, async (req, res) => {
  const provider = validProvider(req, res);
  if (!provider) return;
  try {
    const removed = await disconnectCalendar(req.user.id, provider);
    res.json({ success: true, removed });
  } catch (err) {
    console.error('[Calendar] disconnect failed:', err);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/** Manually re-push one appointment to the connected calendars. */
router.post('/appointments/:id/sync', authenticateToken, resyncLimiter, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, l.owner_name, l.address, l.phone, l.email
         FROM appointments a LEFT JOIN leads l ON l.id = a.lead_id
        WHERE a.id = ? AND a.user_id = ? LIMIT 1`,
      [Number(req.params.id), req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    res.json(await syncAppointmentCalendars(rows[0]));
  } catch (err) {
    console.error('[Calendar] manual sync failed:', err);
    res.status(500).json({ error: 'Calendar sync failed' });
  }
});

export default router;
