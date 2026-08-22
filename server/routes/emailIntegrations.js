import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import {
  listUserEmailStatus,
  disconnectUserEmail,
  createEmailOAuthState,
  consumeEmailOAuthState,
  oauthSuccessRedirect,
  oauthErrorRedirect,
  getUserEmailConnection,
} from '../services/email/userEmailConnections.js';
import { ensurePlatformEmailSettingsLoaded, isGmailOAuthConfigured, isOutlookOAuthConfigured } from '../services/email/platformEmailSettings.js';
import { getGmailAuthorizeUrl, completeGmailOAuth } from '../services/email/gmailService.js';
import { getOutlookAuthorizeUrl, completeOutlookOAuth } from '../services/email/outlookService.js';
import { saveSmtpConnection, sendTestViaConnection } from '../services/email/smtpService.js';
import db from '../db.js';

const router = express.Router();

const testLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const status = await listUserEmailStatus(req.user.id);
    res.json(status);
  } catch (err) {
    console.error('Email integrations list error:', err);
    res.status(500).json({ error: 'Failed to load email integration' });
  }
});

router.get('/connect/gmail', authenticateToken, async (req, res) => {
  try {
    await ensurePlatformEmailSettingsLoaded();
    if (!isGmailOAuthConfigured()) {
      return res.status(503).json({ error: 'Gmail OAuth is not configured on this server' });
    }
    const state = await createEmailOAuthState(req.user.id, 'gmail', req.query.returnTo);
    res.json({ authorizeUrl: getGmailAuthorizeUrl(state) });
  } catch (err) {
    console.error('Gmail connect error:', err);
    res.status(500).json({ error: 'Failed to start Gmail connection' });
  }
});

router.get('/connect/outlook', authenticateToken, async (req, res) => {
  try {
    await ensurePlatformEmailSettingsLoaded();
    if (!isOutlookOAuthConfigured()) {
      return res.status(503).json({ error: 'Outlook OAuth is not configured on this server' });
    }
    const state = await createEmailOAuthState(req.user.id, 'outlook', req.query.returnTo);
    res.json({ authorizeUrl: getOutlookAuthorizeUrl(state) });
  } catch (err) {
    console.error('Outlook connect error:', err);
    res.status(500).json({ error: 'Failed to start Outlook connection' });
  }
});

router.get('/callback/gmail', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(oauthErrorRedirect(String(oauthError)));
    if (!code || !state) return res.redirect(oauthErrorRedirect('Missing OAuth code or state'));
    const row = await consumeEmailOAuthState(String(state));
    if (!row || row.provider !== 'gmail') {
      return res.redirect(oauthErrorRedirect('Invalid or expired OAuth state', row?.return_to));
    }
    await completeGmailOAuth(row.user_id, String(code));
    res.redirect(oauthSuccessRedirect('gmail', row.return_to));
  } catch (err) {
    console.error('Gmail callback error:', err);
    res.redirect(oauthErrorRedirect(err.message || 'Gmail connection failed'));
  }
});

router.get('/callback/outlook', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(oauthErrorRedirect(String(oauthError)));
    if (!code || !state) return res.redirect(oauthErrorRedirect('Missing OAuth code or state'));
    const row = await consumeEmailOAuthState(String(state));
    if (!row || row.provider !== 'outlook') {
      return res.redirect(oauthErrorRedirect('Invalid or expired OAuth state', row?.return_to));
    }
    await completeOutlookOAuth(row.user_id, String(code));
    res.redirect(oauthSuccessRedirect('outlook', row.return_to));
  } catch (err) {
    console.error('Outlook callback error:', err);
    res.redirect(oauthErrorRedirect(err.message || 'Outlook connection failed'));
  }
});

router.put('/smtp', authenticateToken, async (req, res) => {
  try {
    const result = await saveSmtpConnection(req.user.id, req.body || {});
    res.json({ success: true, ...result, message: 'SMTP saved and verified.' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to save SMTP settings' });
  }
});

router.post('/test', authenticateToken, testLimiter, async (req, res) => {
  try {
    const conn = await getUserEmailConnection(req.user.id);
    if (!conn) return res.status(400).json({ error: 'No email connected' });
    const [users] = await db.query('SELECT email, name FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const toEmail = users[0]?.email;
    if (!toEmail) return res.status(400).json({ error: 'Your account has no email address for testing' });
    const result = await sendTestViaConnection(req.user.id, conn, toEmail);
    res.json({ success: true, message: `Test email sent to ${toEmail}`, id: result.id });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Test email failed' });
  }
});

router.delete('/', authenticateToken, async (req, res) => {
  try {
    await disconnectUserEmail(req.user.id);
    res.json({ success: true, message: 'Email disconnected.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect email' });
  }
});

export default router;
