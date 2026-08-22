import {
  getConnection,
  upsertOAuthConnection,
  salesforceRedirectUri,
  isSalesforceConfigured,
} from './crmConnections.js';
import {
  getSalesforceClientId,
  getSalesforceClientSecret,
} from './platformCrmSettings.js';
import { parseAddressParts } from './leadPayload.js';

const AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

export function getSalesforceAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getSalesforceClientId(),
    redirect_uri: salesforceRedirectUri(),
    scope: 'api refresh_token',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getSalesforceClientId(),
    client_secret: getSalesforceClientSecret(),
    redirect_uri: salesforceRedirectUri(),
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Salesforce token exchange failed');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getSalesforceClientId(),
    client_secret: getSalesforceClientSecret(),
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || 'Salesforce token refresh failed');
  return data;
}

async function ensureAccessToken(conn) {
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return { token: conn.access_token, instanceUrl: conn.instance_url };
  if (!conn.refresh_token) throw new Error('Salesforce connection expired — reconnect in Integrations');
  const data = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + 7200 * 1000);
  await upsertOAuthConnection(conn.user_id, 'salesforce', {
    accessToken: data.access_token,
    refreshToken: conn.refresh_token,
    expiresAt,
    instanceUrl: data.instance_url || conn.instance_url,
  });
  return { token: data.access_token, instanceUrl: data.instance_url || conn.instance_url };
}

export async function completeSalesforceOAuth(userId, code) {
  if (!isSalesforceConfigured()) throw new Error('Salesforce OAuth is not configured on the server');
  const data = await exchangeCode(code);
  const expiresAt = new Date(Date.now() + 7200 * 1000);
  await upsertOAuthConnection(userId, 'salesforce', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    instanceUrl: data.instance_url,
  });
  return { instanceUrl: data.instance_url };
}

export async function pushLeadToSalesforce(userId, lead, payload) {
  const conn = await getConnection(userId, 'salesforce');
  if (!conn?.access_token) throw new Error('Salesforce is not connected — connect in Integrations');

  const { token, instanceUrl } = await ensureAccessToken({ ...conn, user_id: userId });
  const addr = parseAddressParts(lead.address);
  const body = {
    FirstName: payload.lead.firstName,
    LastName: payload.lead.lastName,
    Company: payload.lead.ownerName || 'Solar Lead',
    Phone: payload.lead.phone && payload.lead.phone !== 'Not Available' ? payload.lead.phone : undefined,
    Email: payload.lead.email && payload.lead.email !== 'Not Available' ? payload.lead.email : undefined,
    Street: addr.street || lead.address || undefined,
    City: addr.city || undefined,
    State: addr.state || undefined,
    PostalCode: addr.zip || undefined,
    LeadSource: 'SolarX.live',
    Description: [
      `SolarX Lead #${lead.id}`,
      payload.lead.estimatedSavings ? `Est. savings: ${payload.lead.estimatedSavings}` : null,
      lead.notes ? `Notes: ${lead.notes}` : null,
    ].filter(Boolean).join('\n'),
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });

  const res = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Lead/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(Array.isArray(data) ? data[0]?.message : data.message || data.error || 'Salesforce lead create failed');
  }
  return {
    externalId: data.id,
    provider: 'salesforce',
    url: data.id ? `${instanceUrl}/${data.id}` : null,
  };
}
