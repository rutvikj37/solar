/**
 * Per-user Google Calendar / Outlook calendar OAuth connections (tokens encrypted at rest).
 * Credentials: GOOGLE_CALENDAR_CLIENT_ID/SECRET (falls back to the Gmail OAuth client) and
 * MICROSOFT_CALENDAR_CLIENT_ID/SECRET (falls back to the Outlook mail OAuth client).
 */
import db from '../../db.js';
import { encryptSecret, decryptSecret } from '../../utils/secretCrypto.js';
import {
  ensurePlatformEmailSettingsLoaded,
  getGoogleMailClientId,
  getGoogleMailClientSecret,
  getMicrosoftMailClientId,
  getMicrosoftMailClientSecret,
} from '../email/platformEmailSettings.js';
import { getEmailOAuthPublicBase, sanitizeReturnTo } from '../email/userEmailConnections.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';

export const CALENDAR_PROVIDERS = ['google', 'outlook'];

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_SCOPES = 'offline_access User.Read Calendars.ReadWrite';

export class CalendarAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalendarAuthError';
  }
}

const isPlaceholder = (v) => !v || String(v).toLowerCase().includes('your_');
const env = (k) => (process.env[k] || '').trim();

function credentials(provider) {
  if (provider === 'google') {
    const id = env('GOOGLE_CALENDAR_CLIENT_ID') || getGoogleMailClientId();
    const secret = env('GOOGLE_CALENDAR_CLIENT_ID') ? env('GOOGLE_CALENDAR_CLIENT_SECRET') : getGoogleMailClientSecret();
    return { id, secret };
  }
  const id = env('MICROSOFT_CALENDAR_CLIENT_ID') || getMicrosoftMailClientId();
  const secret = env('MICROSOFT_CALENDAR_CLIENT_ID') ? env('MICROSOFT_CALENDAR_CLIENT_SECRET') : getMicrosoftMailClientSecret();
  return { id, secret };
}

export async function isCalendarProviderConfigured(provider) {
  await ensurePlatformEmailSettingsLoaded();
  const { id, secret } = credentials(provider);
  return Boolean(!isPlaceholder(id) && !isPlaceholder(secret));
}

export function calendarRedirectUri(provider) {
  return `${getEmailOAuthPublicBase()}/api/calendar/callback/${provider}`;
}

function frontendBase() {
  return resolveFrontendBaseUrl();
}

export function calendarOAuthRedirect(params, returnTo = null) {
  const safe = sanitizeReturnTo(returnTo);
  const base = `${frontendBase()}${safe || '/integrations'}`;
  return `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;
}

export async function getCalendarAuthorizeUrl(provider, state) {
  await ensurePlatformEmailSettingsLoaded();
  const { id } = credentials(provider);
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: calendarRedirectUri('google'),
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'select_account consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params}`;
  }
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: calendarRedirectUri('outlook'),
    response_type: 'code',
    response_mode: 'query',
    scope: MS_SCOPES,
    prompt: 'select_account',
    state,
  });
  return `${MS_AUTH_URL}?${params}`;
}

async function tokenRequest(provider, body) {
  const { id, secret } = credentials(provider);
  const res = await fetch(provider === 'google' ? GOOGLE_TOKEN_URL : MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || `Token request failed (${res.status})`;
    if (data.error === 'invalid_grant' || res.status === 400 || res.status === 401) throw new CalendarAuthError(msg);
    throw new Error(msg);
  }
  return data;
}

async function fetchAccountEmail(provider, accessToken) {
  try {
    const url =
      provider === 'google' ? 'https://www.googleapis.com/oauth2/v2/userinfo' : 'https://graph.microsoft.com/v1.0/me';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    return data.email || data.mail || data.userPrincipalName || null;
  } catch {
    return null;
  }
}

export async function completeCalendarOAuth(provider, userId, code) {
  if (!(await isCalendarProviderConfigured(provider))) throw new Error('Calendar OAuth is not configured on the server');
  const data = await tokenRequest(provider, {
    code,
    redirect_uri: calendarRedirectUri(provider),
    grant_type: 'authorization_code',
    ...(provider === 'outlook' ? { scope: MS_SCOPES } : {}),
  });
  const accountEmail = await fetchAccountEmail(provider, data.access_token);
  const existing = await getCalendarConnection(userId, provider);
  const refresh = data.refresh_token || (existing ? decryptSecret(existing.refresh_token_enc) : null);
  await db.query(
    `INSERT INTO user_calendar_connections
       (user_id, provider, account_email, access_token_enc, refresh_token_enc, token_expires_at, granted_scopes, status, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL)
     ON DUPLICATE KEY UPDATE account_email = VALUES(account_email), access_token_enc = VALUES(access_token_enc),
       refresh_token_enc = VALUES(refresh_token_enc), token_expires_at = VALUES(token_expires_at),
       granted_scopes = VALUES(granted_scopes), status = 'ok', last_error = NULL, connected_at = CURRENT_TIMESTAMP`,
    [
      userId,
      provider,
      accountEmail,
      encryptSecret(data.access_token),
      encryptSecret(refresh),
      new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
      data.scope || null,
    ],
  );
  return { accountEmail };
}

export async function getCalendarConnection(userId, provider) {
  const [rows] = await db.query('SELECT * FROM user_calendar_connections WHERE user_id = ? AND provider = ? LIMIT 1', [
    userId,
    provider,
  ]);
  return rows[0] || null;
}

export async function listCalendarConnections(userId) {
  const [rows] = await db.query('SELECT * FROM user_calendar_connections WHERE user_id = ?', [userId]);
  return rows;
}

export async function markCalendarConnection(userId, provider, { status, error = null, synced = false }) {
  await db.query(
    `UPDATE user_calendar_connections SET status = ?, last_error = ?${synced ? ', last_sync_at = NOW()' : ''}
      WHERE user_id = ? AND provider = ?`,
    [status, error ? String(error).slice(0, 500) : null, userId, provider],
  );
}

/** Valid access token for a stored connection (refreshes when < 1 min left). */
export async function getCalendarAccessToken(conn) {
  if (!conn) return null;
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const current = decryptSecret(conn.access_token_enc);
  if (current && expires > Date.now() + 60_000) return current;
  const refresh = decryptSecret(conn.refresh_token_enc);
  if (!refresh) throw new CalendarAuthError('Calendar connection expired. Reconnect in Integrations.');
  if (!(await isCalendarProviderConfigured(conn.provider))) throw new Error('Calendar OAuth is not configured on the server');
  const data = await tokenRequest(conn.provider, {
    refresh_token: refresh,
    grant_type: 'refresh_token',
    ...(conn.provider === 'outlook' ? { scope: MS_SCOPES } : {}),
  });
  await db.query(
    `UPDATE user_calendar_connections SET access_token_enc = ?, token_expires_at = ?,
       refresh_token_enc = COALESCE(?, refresh_token_enc) WHERE id = ?`,
    [
      encryptSecret(data.access_token),
      new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
      data.refresh_token ? encryptSecret(data.refresh_token) : null,
      conn.id,
    ],
  );
  return data.access_token;
}

export async function disconnectCalendar(userId, provider) {
  const conn = await getCalendarConnection(userId, provider);
  if (!conn) return false;
  if (provider === 'google') {
    const token = decryptSecret(conn.refresh_token_enc) || decryptSecret(conn.access_token_enc);
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  }
  await db.query('DELETE FROM user_calendar_connections WHERE id = ?', [conn.id]);
  return true;
}

export async function getCalendarStatus(userId, { includeMissingEnv = false } = {}) {
  const rows = await listCalendarConnections(userId);
  const providers = {};
  const missingEnv = [];
  for (const provider of CALENDAR_PROVIDERS) {
    const conn = rows.find((r) => r.provider === provider);
    const configured = await isCalendarProviderConfigured(provider);
    if (!configured) {
      missingEnv.push(
        ...(provider === 'google'
          ? ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET']
          : ['MICROSOFT_CALENDAR_CLIENT_ID', 'MICROSOFT_CALENDAR_CLIENT_SECRET']),
      );
    }
    providers[provider] = {
      configured,
      connected: Boolean(conn),
      accountEmail: conn?.account_email || null,
      status: conn?.status || null,
      lastError: conn?.last_error || null,
      lastSyncAt: conn?.last_sync_at || null,
      redirectUri: includeMissingEnv ? calendarRedirectUri(provider) : undefined,
    };
  }
  return { providers, ...(includeMissingEnv ? { missingEnv } : {}) };
}
