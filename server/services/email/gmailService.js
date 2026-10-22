import {
  getUserEmailConnection,
  upsertUserEmailConnection,
  gmailRedirectUri,
  isInboxSyncEnabled,
} from './userEmailConnections.js';

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
import {
  getGoogleMailClientId,
  getGoogleMailClientSecret,
  isGmailOAuthConfigured,
} from './platformEmailSettings.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function getGmailAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: getGoogleMailClientId(),
    redirect_uri: gmailRedirectUri(),
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      ...(isInboxSyncEnabled() ? [GMAIL_READ_SCOPE] : []),
    ].join(' '),
    access_type: 'offline',
    prompt: 'select_account consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleMailClientId(),
    client_secret: getGoogleMailClientSecret(),
    redirect_uri: gmailRedirectUri(),
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Gmail token exchange failed');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: getGoogleMailClientId(),
    client_secret: getGoogleMailClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || 'Gmail token refresh failed');
  return data;
}

async function fetchGoogleEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Could not read Gmail profile');
  return data.email;
}

export async function ensureGmailAccessToken(conn) {
  return ensureAccessToken(conn);
}

async function ensureAccessToken(conn) {
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error('Gmail connection expired — reconnect in Integrations');
  const data = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertUserEmailConnection(conn.user_id, {
    provider: 'gmail',
    accessToken: data.access_token,
    refreshToken: conn.refresh_token,
    expiresAt,
    fromEmail: conn.from_email,
    fromName: conn.from_name,
  });
  return data.access_token;
}

export async function completeGmailOAuth(userId, code) {
  if (!isGmailOAuthConfigured()) throw new Error('Gmail OAuth is not configured on the server');
  const data = await exchangeCode(code);
  const fromEmail = await fetchGoogleEmail(data.access_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertUserEmailConnection(userId, {
    provider: 'gmail',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    fromEmail,
    fromName: fromEmail.split('@')[0],
    grantedScopes: data.scope || null,
  });
  return { fromEmail };
}

function buildRawMessage({ fromName, fromEmail, to, subject, body, headers }) {
  const fromHeader = fromName ? `"${fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
  const extraHeaders = Object.entries(headers || {})
    .filter(([k, v]) => /^[A-Za-z0-9-]+$/.test(k) && v && !/[\r\n]/.test(String(v)))
    .map(([k, v]) => `${k}: ${v}`);
  const lines = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    ...extraHeaders,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendViaGmail(userId, { to, subject, body, headers = null }) {
  const conn = await getUserEmailConnection(userId);
  if (!conn?.access_token || conn.provider !== 'gmail') {
    throw new Error('Gmail is not connected — connect in Integrations');
  }
  const accessToken = await ensureAccessToken({ ...conn, user_id: userId });
  const raw = buildRawMessage({
    fromName: conn.from_name,
    fromEmail: conn.from_email,
    to,
    subject,
    body,
    headers,
  });
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Gmail send failed');
  return { ok: true, id: data.id, threadId: data.threadId || null, from: conn.from_email, simulated: false };
}
