import crypto from 'crypto';
import db from '../../db.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';
import {
  ensurePlatformCrmSettingsLoaded,
  getOAuthPublicUrlOverride,
  isHubSpotConfiguredFromSettings,
  isSalesforceConfiguredFromSettings,
} from './platformCrmSettings.js';

export const CRM_PROVIDERS = ['hubspot', 'salesforce'];

function frontendBase() {
  return resolveFrontendBaseUrl();
}

/** Base URL HubSpot/Salesforce redirect to — must match app settings exactly. */
export function getCrmOAuthPublicBase() {
  const fromSettings = getOAuthPublicUrlOverride();
  if (fromSettings) return fromSettings;

  const port = process.env.PORT || 5002;
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    return `http://localhost:${port}`;
  }

  const publicUrl = process.env.PUBLIC_URL?.trim();
  if (publicUrl) return publicUrl.split(',')[0].trim().replace(/\/$/, '');
  return `http://localhost:${port}`;
}

function apiBase() {
  return getCrmOAuthPublicBase();
}

export function getCrmSetupStatus(forAdmin = false) {
  const base = getCrmOAuthPublicBase();
  const missing = [];
  if (!isHubSpotConfiguredFromSettings()) {
    missing.push('HUBSPOT_CLIENT_ID');
    missing.push('HUBSPOT_CLIENT_SECRET');
  }
  if (!isSalesforceConfiguredFromSettings()) {
    missing.push('SALESFORCE_CLIENT_ID');
    missing.push('SALESFORCE_CLIENT_SECRET');
  }

  const status = {
    oauthPublicUrl: base,
    hubspotRedirectUri: `${base}/api/crm/integrations/callback/hubspot`,
    salesforceRedirectUri: `${base}/api/crm/integrations/callback/salesforce`,
    hubspotConfigured: isHubSpotConfigured(),
    salesforceConfigured: isSalesforceConfigured(),
    ready: isHubSpotConfigured() || isSalesforceConfigured(),
  };

  if (forAdmin) {
    status.missingEnv = missing;
  }

  return status;
}

export function isHubSpotConfigured() {
  return isHubSpotConfiguredFromSettings();
}

export function isSalesforceConfigured() {
  return isSalesforceConfiguredFromSettings();
}

export async function listUserCrmConnections(userId) {
  await ensurePlatformCrmSettingsLoaded();

  const [rows] = await db.query(
    `SELECT provider, portal_id, instance_url, webhook_url, connected_at, updated_at,
            token_expires_at, metadata
     FROM user_crm_connections WHERE user_id = ?`,
    [userId],
  );
  const map = Object.fromEntries(CRM_PROVIDERS.map((p) => [p, { connected: false, provider: p }]));
  for (const row of rows) {
    map[row.provider] = {
      provider: row.provider,
      connected: Boolean(row.access_token),
      portalId: row.portal_id,
      instanceUrl: row.instance_url,
      webhookUrl: row.webhook_url ? `${String(row.webhook_url).slice(0, 48)}…` : null,
      connectedAt: row.connected_at,
      updatedAt: row.updated_at,
    };
  }
  return {
    providers: CRM_PROVIDERS.map((p) => map[p]),
    hubspotAvailable: isHubSpotConfigured(),
    salesforceAvailable: isSalesforceConfigured(),
  };
}

export async function getConnection(userId, provider) {
  const [rows] = await db.query(
    'SELECT * FROM user_crm_connections WHERE user_id = ? AND provider = ? LIMIT 1',
    [userId, provider],
  );
  return rows[0] || null;
}

export async function disconnectProvider(userId, provider) {
  await db.query('DELETE FROM user_crm_connections WHERE user_id = ? AND provider = ?', [userId, provider]);
}

export async function createOAuthState(userId, provider, returnTo = null) {
  const state = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  const safeReturn = sanitizeReturnTo(returnTo);
  await db.query(
    'INSERT INTO user_crm_oauth_states (state, user_id, provider, expires_at, return_to) VALUES (?, ?, ?, ?, ?)',
    [state, userId, provider, expires, safeReturn],
  );
  return state;
}

export async function consumeOAuthState(state) {
  const [rows] = await db.query(
    'SELECT * FROM user_crm_oauth_states WHERE state = ? AND expires_at > NOW() LIMIT 1',
    [state],
  );
  if (!rows.length) return null;
  await db.query('DELETE FROM user_crm_oauth_states WHERE state = ?', [state]);
  return rows[0];
}

export async function upsertOAuthConnection(userId, provider, tokens) {
  await db.query(
    `INSERT INTO user_crm_connections
      (user_id, provider, access_token, refresh_token, token_expires_at, instance_url, portal_id, metadata, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token),
       refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
       token_expires_at = VALUES(token_expires_at),
       instance_url = COALESCE(VALUES(instance_url), instance_url),
       portal_id = COALESCE(VALUES(portal_id), portal_id),
       metadata = VALUES(metadata),
       updated_at = NOW()`,
    [
      userId,
      provider,
      tokens.accessToken,
      tokens.refreshToken || null,
      tokens.expiresAt || null,
      tokens.instanceUrl || null,
      tokens.portalId || null,
      tokens.metadata ? JSON.stringify(tokens.metadata) : null,
    ],
  );
}

export function hubspotRedirectUri() {
  return `${apiBase()}/api/crm/integrations/callback/hubspot`;
}

export function salesforceRedirectUri() {
  return `${apiBase()}/api/crm/integrations/callback/salesforce`;
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
  return `${base}${sep}crm=${encodeURIComponent(provider)}_connected`;
}

export function oauthErrorRedirect(message, returnTo = null) {
  const safe = sanitizeReturnTo(returnTo);
  const base = safe ? `${frontendBase()}${safe}` : `${frontendBase()}/integrations`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}crm_error=${encodeURIComponent(message)}`;
}
