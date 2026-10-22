import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { resolveFrontendBaseUrl } from '../utils/frontendUrl.js';
import {
  getLeadOptOutStatus,
  isEmailOptedOut,
  recordOptOut,
  revokeOptOut,
} from '../services/compliance/optOut.js';
import { verifyUnsubscribeToken } from '../services/compliance/emailCompliance.js';
import { CURRENT_CONSENT_VERSION, getConsentText } from '../services/compliance/consent.js';

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

function tokenFrom(req) {
  return String(req.query.t || req.body?.t || req.body?.token || '').trim();
}

/** Current homeowner consent wording (the lead form must submit this version). */
router.get('/consent', (_req, res) => {
  res.json({ version: CURRENT_CONSENT_VERSION, text: getConsentText(CURRENT_CONSENT_VERSION) });
});

/** Footer link target: send the browser to the confirmation page. */
router.get('/unsubscribe', publicLimiter, (req, res) => {
  const t = tokenFrom(req);
  res.redirect(302, `${resolveFrontendBaseUrl()}/unsubscribe?t=${encodeURIComponent(t)}`);
});

router.get('/unsubscribe/status', publicLimiter, async (req, res) => {
  const data = verifyUnsubscribeToken(tokenFrom(req));
  if (!data) return res.status(400).json({ error: 'This unsubscribe link is invalid.' });
  res.json({ email: maskEmail(data.email), unsubscribed: await isEmailOptedOut(data.email) });
});

/** RFC 8058 one-click (mail client POST) and the confirmation page both land here. */
router.post('/unsubscribe', publicLimiter, async (req, res) => {
  const data = verifyUnsubscribeToken(tokenFrom(req));
  if (!data) return res.status(400).json({ error: 'This unsubscribe link is invalid.' });
  const oneClick = String(req.body?.['List-Unsubscribe'] || '') === 'One-Click';
  try {
    await recordOptOut({
      email: data.email,
      channel: 'email',
      source: oneClick ? 'email_one_click' : 'email_unsubscribe',
      userId: data.userId,
      leadId: data.leadId,
    });
    res.json({ ok: true, email: maskEmail(data.email), unsubscribed: true });
  } catch (err) {
    console.error('[Compliance] unsubscribe failed:', err.message);
    res.status(500).json({ error: 'Could not process unsubscribe. Please try again.' });
  }
});

router.post('/resubscribe', publicLimiter, async (req, res) => {
  const data = verifyUnsubscribeToken(tokenFrom(req));
  if (!data) return res.status(400).json({ error: 'This link is invalid.' });
  try {
    await revokeOptOut({ email: data.email, channel: 'email', source: 'email_resubscribe', userId: data.userId });
    res.json({ ok: true, email: maskEmail(data.email), unsubscribed: false });
  } catch (err) {
    console.error('[Compliance] resubscribe failed:', err.message);
    res.status(500).json({ error: 'Could not process request. Please try again.' });
  }
});

/** Opt-out status for a CRM lead (badge on lead details). */
router.get('/leads/:id/status', authenticateToken, async (req, res) => {
  try {
    const lead = await fetchLeadForUser(req.params.id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(await getLeadOptOutStatus(lead));
  } catch (err) {
    console.error('[Compliance] lead status failed:', err.message);
    res.status(500).json({ error: 'Failed to load opt-out status' });
  }
});

export default router;
