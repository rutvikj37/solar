import db from '../../db.js';

let cached = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000;

function isPlaceholder(value) {
  const v = (value || '').trim().toLowerCase();
  return !v || v.includes('your_');
}

function resolveCredential(dbValue, envKey) {
  const fromDb = (dbValue || '').trim();
  if (fromDb && !isPlaceholder(fromDb)) return fromDb;
  return (process.env[envKey] || '').trim();
}

export function invalidatePlatformCrmSettingsCache() {
  cached = null;
  cacheTime = 0;
}

export async function getPlatformCrmSettingsRow() {
  if (cached && Date.now() - cacheTime < CACHE_TTL_MS) return cached;
  const [rows] = await db.query('SELECT * FROM platform_crm_settings WHERE id = 1 LIMIT 1');
  cached = rows[0] || {};
  cacheTime = Date.now();
  return cached;
}

export async function ensurePlatformCrmSettingsLoaded() {
  await getPlatformCrmSettingsRow();
}

export function getHubSpotClientId() {
  return resolveCredential(cached?.hubspot_client_id, 'HUBSPOT_CLIENT_ID');
}

export function getHubSpotClientSecret() {
  return resolveCredential(cached?.hubspot_client_secret, 'HUBSPOT_CLIENT_SECRET');
}

export function getSalesforceClientId() {
  return resolveCredential(cached?.salesforce_client_id, 'SALESFORCE_CLIENT_ID');
}

export function getSalesforceClientSecret() {
  return resolveCredential(cached?.salesforce_client_secret, 'SALESFORCE_CLIENT_SECRET');
}

export function getOAuthPublicUrlOverride() {
  const fromDb = (cached?.oauth_public_url || '').trim();
  if (fromDb) return fromDb.split(',')[0].trim().replace(/\/$/, '');
  const explicit = process.env.CRM_OAUTH_PUBLIC_URL?.trim();
  if (explicit) return explicit.split(',')[0].trim().replace(/\/$/, '');
  return null;
}

export function isHubSpotConfiguredFromSettings() {
  const id = getHubSpotClientId();
  const secret = getHubSpotClientSecret();
  return Boolean(id && secret && !isPlaceholder(id) && !isPlaceholder(secret));
}

export function isSalesforceConfiguredFromSettings() {
  const id = getSalesforceClientId();
  const secret = getSalesforceClientSecret();
  return Boolean(id && secret && !isPlaceholder(id) && !isPlaceholder(secret));
}

function maskSecret(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.length <= 4) return '••••';
  return `••••${v.slice(-4)}`;
}

export async function getAdminCrmOAuthSettings() {
  const row = await getPlatformCrmSettingsRow();
  const hubspotClientId = getHubSpotClientId();
  const salesforceClientId = getSalesforceClientId();
  const hubspotSecret = getHubSpotClientSecret();
  const salesforceSecret = getSalesforceClientSecret();

  return {
    hubspotClientId: (row.hubspot_client_id || '').trim() || hubspotClientId || '',
    hubspotClientSecretSet: Boolean(hubspotSecret),
    hubspotClientSecretMasked: maskSecret(hubspotSecret),
    salesforceClientId: (row.salesforce_client_id || '').trim() || salesforceClientId || '',
    salesforceClientSecretSet: Boolean(salesforceSecret),
    salesforceClientSecretMasked: maskSecret(salesforceSecret),
    oauthPublicUrl:
      (row.oauth_public_url || '').trim() ||
      process.env.CRM_OAUTH_PUBLIC_URL?.trim() ||
      '',
    fromEnv: {
      hubspotClientId: Boolean(process.env.HUBSPOT_CLIENT_ID?.trim() && !row.hubspot_client_id?.trim()),
      hubspotClientSecret: Boolean(process.env.HUBSPOT_CLIENT_SECRET?.trim() && !row.hubspot_client_secret?.trim()),
      salesforceClientId: Boolean(process.env.SALESFORCE_CLIENT_ID?.trim() && !row.salesforce_client_id?.trim()),
      salesforceClientSecret: Boolean(
        process.env.SALESFORCE_CLIENT_SECRET?.trim() && !row.salesforce_client_secret?.trim(),
      ),
      oauthPublicUrl: Boolean(process.env.CRM_OAUTH_PUBLIC_URL?.trim() && !row.oauth_public_url?.trim()),
    },
  };
}

export async function saveAdminCrmOAuthSettings(payload = {}) {
  const existing = await getPlatformCrmSettingsRow();
  const hubspotClientId = String(payload.hubspotClientId ?? existing.hubspot_client_id ?? '').trim();
  const salesforceClientId = String(payload.salesforceClientId ?? existing.salesforce_client_id ?? '').trim();
  const oauthPublicUrl = String(payload.oauthPublicUrl ?? existing.oauth_public_url ?? '').trim();

  let hubspotClientSecret = existing.hubspot_client_secret || '';
  if (payload.hubspotClientSecret != null && String(payload.hubspotClientSecret).trim()) {
    hubspotClientSecret = String(payload.hubspotClientSecret).trim();
  }

  let salesforceClientSecret = existing.salesforce_client_secret || '';
  if (payload.salesforceClientSecret != null && String(payload.salesforceClientSecret).trim()) {
    salesforceClientSecret = String(payload.salesforceClientSecret).trim();
  }

  await db.query(
    `INSERT INTO platform_crm_settings
      (id, hubspot_client_id, hubspot_client_secret, salesforce_client_id, salesforce_client_secret, oauth_public_url)
     VALUES (1, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       hubspot_client_id = VALUES(hubspot_client_id),
       hubspot_client_secret = VALUES(hubspot_client_secret),
       salesforce_client_id = VALUES(salesforce_client_id),
       salesforce_client_secret = VALUES(salesforce_client_secret),
       oauth_public_url = VALUES(oauth_public_url),
       updated_at = CURRENT_TIMESTAMP`,
    [hubspotClientId, hubspotClientSecret, salesforceClientId, salesforceClientSecret, oauthPublicUrl],
  );

  invalidatePlatformCrmSettingsCache();
  await getPlatformCrmSettingsRow();
  return getAdminCrmOAuthSettings();
}
