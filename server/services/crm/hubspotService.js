import {
  getConnection,
  upsertOAuthConnection,
  hubspotRedirectUri,
  isHubSpotConfigured,
} from './crmConnections.js';
import {
  getHubSpotClientId,
  getHubSpotClientSecret,
} from './platformCrmSettings.js';
import { parseAddressParts } from './leadPayload.js';

const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export function getHubSpotAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: getHubSpotClientId(),
    redirect_uri: hubspotRedirectUri(),
    scope: [
      'oauth',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
    ].join(' '),
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getHubSpotClientId(),
    client_secret: getHubSpotClientSecret(),
    redirect_uri: hubspotRedirectUri(),
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'HubSpot token exchange failed');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getHubSpotClientId(),
    client_secret: getHubSpotClientSecret(),
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'HubSpot token refresh failed');
  return data;
}

async function ensureAccessToken(conn) {
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error('HubSpot connection expired — reconnect in Integrations');
  const data = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertOAuthConnection(conn.user_id, 'hubspot', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || conn.refresh_token,
    expiresAt,
    portalId: conn.portal_id,
  });
  return data.access_token;
}

export async function completeHubSpotOAuth(userId, code) {
  if (!isHubSpotConfigured()) throw new Error('HubSpot OAuth is not configured on the server');
  const data = await exchangeCode(code);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await upsertOAuthConnection(userId, 'hubspot', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    portalId: data.hub_id ? String(data.hub_id) : null,
  });
  return { portalId: data.hub_id };
}

export async function pushLeadToHubSpot(userId, lead, payload) {
  const conn = await getConnection(userId, 'hubspot');
  if (!conn?.access_token) throw new Error('HubSpot is not connected — connect in Integrations');

  const accessToken = await ensureAccessToken({ ...conn, user_id: userId });
  const addr = parseAddressParts(lead.address);
  const properties = {
    firstname: payload.lead.firstName,
    lastname: payload.lead.lastName,
    phone: payload.lead.phone || undefined,
    email: payload.lead.email || undefined,
    address: addr.street || lead.address || undefined,
    city: addr.city || undefined,
    state: addr.state || undefined,
    zip: addr.zip || undefined,
    lifecyclestage: 'lead',
    hs_lead_status: 'NEW',
    solarx_lead_id: String(lead.id),
    solarx_lead_score: payload.lead.leadScore != null ? String(payload.lead.leadScore) : undefined,
  };
  Object.keys(properties).forEach((k) => {
    if (properties[k] === undefined || properties[k] === 'Not Available') delete properties[k];
  });

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.errors?.[0]?.message || 'HubSpot contact create failed');
  }
  return { externalId: data.id, provider: 'hubspot', url: data.id ? `https://app.hubspot.com/contacts/${conn.portal_id}/contact/${data.id}` : null };
}
