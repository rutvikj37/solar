import crypto from 'crypto';
import db from '../../db.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';
import {
  ensurePlatformEmailSettingsLoaded,
  getEmailOAuthPublicUrlOverride,
  isGmailOAuthConfigured,
  isOutlookOAuthConfigured,
} from './platformEmailSettings.js';

export const EMAIL_PROVIDERS = ['gmail', 'outlook', 'smtp'];

/** Reply sync needs read scopes (gmail.readonly / Mail.Read). EMAIL_INBOX_SYNC=0 keeps send-only OAuth. */
export function isInboxSyncEnabled() {
  return String(process.env.EMAIL_INBOX_SYNC ?? '1').trim() !== '0';
}

function frontendBase() {
  return resolveFrontendBaseUrl();
}

export function getEmailOAuthPublicBase() {
  const fromSettings = getEmailOAuthPublicUrlOverride();
  if (fromSettings) return fromSettings;

  const port = process.env.PORT || 5002;
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return `http://localhost:${port}`;

  const publicUrl = process.env.PUBLIC_URL?.trim();
  if (publicUrl) return publicUrl.split(',')[0].trim().replace(/\/$/, '');
  return `http://localhost:${port}`;
}

function apiBase() {
  return getEmailOAuthPublicBase();
}

export function getEmailSetupStatus(forAdmin = false) {
  const base = getEmailOAuthPublicBase();
  const status = {
    oauthPublicUrl: base,
    gmailRedirectUri: `${base}/api/email/integrations/callback/gmail`,
    outlookRedirectUri: `${base}/api/email/integrations/callback/outlook`,
    gmailConfigured: isGmailOAuthConfigured(),
    outlookConfigured: isOutlookOAuthConfigured(),
    ready: isGmailOAuthConfigured() || isOutlookOAuthConfigured(),
  };
  if (forAdmin) {
    status.missingEnv = [];
    if (!isGmailOAuthConfigured()) {
      status.missingEnv.push('GOOGLE_MAIL_CLIENT_ID', 'GOOGLE_MAIL_CLIENT_SECRET');
    }
    if (!isOutlookOAuthConfigured()) {
      status.missingEnv.push('MICROSOFT_MAIL_CLIENT_ID', 'MICROSOFT_MAIL_CLIENT_SECRET');
    }
  }
  return status;
}

export function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') return null;
  const path = returnTo.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return null;
  if (path.length > 512) return null;
  return path;
}

export function oauthSuccessRedirect(provider, returnTo = null) {
  const safe = sanitizeReturnTo(returnTo);
  const base = safe ? `${frontendBase()}${safe}` : `${frontendBase()}/integrations`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}email=${encodeURIComponent(provider)}_connected`;
}

export function oauthErrorRedirect(message, returnTo = null) {
  const safe = sanitizeReturnTo(returnTo);
  const base = safe ? `${frontendBase()}${safe}` : `${frontendBase()}/integrations`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}email_error=${encodeURIComponent(message)}`;
}

export function gmailRedirectUri() {
  return `${apiBase()}/api/email/integrations/callback/gmail`;
}

export function outlookRedirectUri() {
  return `${apiBase()}/api/email/integrations/callback/outlook`;
}

export async function getUserEmailConnection(userId) {
  const [rows] = await db.query('SELECT * FROM user_email_connections WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

export async function listUserEmailStatus(userId) {
  await ensurePlatformEmailSettingsLoaded();
  const conn = await getUserEmailConnection(userId);
  return {
    connected: Boolean(conn),
    provider: conn?.provider || null,
    fromEmail: conn?.from_email || null,
    fromName: conn?.from_name || null,
    connectedAt: conn?.connected_at || null,
    gmailAvailable: isGmailOAuthConfigured(),
    outlookAvailable: isOutlookOAuthConfigured(),
    smtpAvailable: true,
    inbox: {
      enabled: isInboxSyncEnabled(),
      supported: conn ? conn.provider === 'gmail' || conn.provider === 'outlook' : false,
      lastSyncAt: conn?.inbox_sync_at || null,
      status: conn?.inbox_sync_status || null,
      error: conn?.inbox_sync_error || null,
    },
  };
}

export async function disconnectUserEmail(userId) {
  await db.query('DELETE FROM user_email_connections WHERE user_id = ?', [userId]);
}

export async function createEmailOAuthState(userId, provider, returnTo = null) {
  const state = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await db.query(
    'INSERT INTO user_email_oauth_states (state, user_id, provider, expires_at, return_to) VALUES (?, ?, ?, ?, ?)',
    [state, userId, provider, expires, sanitizeReturnTo(returnTo)],
  );
  return state;
}

export async function consumeEmailOAuthState(state) {
  const [rows] = await db.query(
    'SELECT * FROM user_email_oauth_states WHERE state = ? AND expires_at > NOW() LIMIT 1',
    [state],
  );
  if (!rows.length) return null;
  await db.query('DELETE FROM user_email_oauth_states WHERE state = ?', [state]);
  return rows[0];
}

export async function upsertUserEmailConnection(userId, data) {
  await db.query(
    `INSERT INTO user_email_connections
      (user_id, provider, access_token, refresh_token, token_expires_at, from_email, from_name,
       smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted, granted_scopes, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       access_token = VALUES(access_token),
       refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
       token_expires_at = VALUES(token_expires_at),
       from_email = VALUES(from_email),
       from_name = VALUES(from_name),
       smtp_host = VALUES(smtp_host),
       smtp_port = VALUES(smtp_port),
       smtp_secure = VALUES(smtp_secure),
       smtp_username = VALUES(smtp_username),
       smtp_password_encrypted = COALESCE(VALUES(smtp_password_encrypted), smtp_password_encrypted),
       granted_scopes = COALESCE(VALUES(granted_scopes), granted_scopes),
       inbox_sync_status = IF(VALUES(granted_scopes) IS NULL, inbox_sync_status, NULL),
       inbox_sync_error = IF(VALUES(granted_scopes) IS NULL, inbox_sync_error, NULL),
       updated_at = NOW()`,
    [
      userId,
      data.provider,
      data.accessToken || null,
      data.refreshToken || null,
      data.expiresAt || null,
      data.fromEmail || null,
      data.fromName || null,
      data.smtpHost || null,
      data.smtpPort || null,
      data.smtpSecure != null ? (data.smtpSecure ? 1 : 0) : 1,
      data.smtpUsername || null,
      data.smtpPasswordEncrypted || null,
      data.grantedScopes || null,
    ],
  );
}
