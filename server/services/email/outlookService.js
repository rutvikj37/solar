import {
  getUserEmailConnection,
  upsertUserEmailConnection,
  outlookRedirectUri,
} from './userEmailConnections.js';
import {
  getMicrosoftMailClientId,
  getMicrosoftMailClientSecret,
  isOutlookOAuthConfigured,
} from './platformEmailSettings.js';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export function getOutlookAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: getMicrosoftMailClientId(),
    redirect_uri: outlookRedirectUri(),
    response_type: 'code',
    scope: 'offline_access Mail.Send User.Read',
    prompt: 'select_account',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: getMicrosoftMailClientId(),
    client_secret: getMicrosoftMailClientSecret(),
    redirect_uri: outlookRedirectUri(),
    grant_type: 'authorization_code',
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Outlook token exchange failed');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: getMicrosoftMailClientId(),
    client_secret: getMicrosoftMailClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'offline_access Mail.Send User.Read',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || 'Outlook token refresh failed');
  return data;
}

async function fetchOutlookProfile(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Could not read Outlook profile');
  return {
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
}

async function ensureAccessToken(conn) {
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error('Outlook connection expired — reconnect in Integrations');
  const data = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertUserEmailConnection(conn.user_id, {
    provider: 'outlook',
    accessToken: data.access_token,
    refreshToken: data.refresh_token || conn.refresh_token,
    expiresAt,
    fromEmail: conn.from_email,
    fromName: conn.from_name,
  });
  return data.access_token;
}

export async function completeOutlookOAuth(userId, code) {
  if (!isOutlookOAuthConfigured()) throw new Error('Outlook OAuth is not configured on the server');
  const data = await exchangeCode(code);
  const profile = await fetchOutlookProfile(data.access_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertUserEmailConnection(userId, {
    provider: 'outlook',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    fromEmail: profile.email,
    fromName: profile.name || profile.email?.split('@')[0],
  });
  return { fromEmail: profile.email };
}

export async function sendViaOutlook(userId, { to, subject, body }) {
  const conn = await getUserEmailConnection(userId);
  if (!conn?.access_token || conn.provider !== 'outlook') {
    throw new Error('Outlook is not connected — connect in Integrations');
  }
  const accessToken = await ensureAccessToken({ ...conn, user_id: userId });
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Outlook send failed');
  }
  return { ok: true, id: `outlook_${Date.now()}`, from: conn.from_email, simulated: false };
}
