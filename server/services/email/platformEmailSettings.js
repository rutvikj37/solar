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

export function invalidatePlatformEmailSettingsCache() {
  cached = null;
  cacheTime = 0;
}

export async function getPlatformEmailSettingsRow() {
  if (cached && Date.now() - cacheTime < CACHE_TTL_MS) return cached;
  const [rows] = await db.query('SELECT * FROM platform_email_settings WHERE id = 1 LIMIT 1');
  cached = rows[0] || {};
  cacheTime = Date.now();
  return cached;
}

export async function ensurePlatformEmailSettingsLoaded() {
  await getPlatformEmailSettingsRow();
}

export function getGoogleMailClientId() {
  return resolveCredential(cached?.google_client_id, 'GOOGLE_MAIL_CLIENT_ID');
}

export function getGoogleMailClientSecret() {
  return resolveCredential(cached?.google_client_secret, 'GOOGLE_MAIL_CLIENT_SECRET');
}

export function getMicrosoftMailClientId() {
  return resolveCredential(cached?.microsoft_client_id, 'MICROSOFT_MAIL_CLIENT_ID');
}

export function getMicrosoftMailClientSecret() {
  return resolveCredential(cached?.microsoft_client_secret, 'MICROSOFT_MAIL_CLIENT_SECRET');
}

export function getEmailOAuthPublicUrlOverride() {
  const fromDb = (cached?.oauth_public_url || '').trim();
  if (fromDb) return fromDb.split(',')[0].trim().replace(/\/$/, '');
  const explicit = process.env.EMAIL_OAUTH_PUBLIC_URL?.trim();
  if (explicit) return explicit.split(',')[0].trim().replace(/\/$/, '');
  return null;
}

export function isGmailOAuthConfigured() {
  const id = getGoogleMailClientId();
  const secret = getGoogleMailClientSecret();
  return Boolean(id && secret && !isPlaceholder(id) && !isPlaceholder(secret));
}

export function isOutlookOAuthConfigured() {
  const id = getMicrosoftMailClientId();
  const secret = getMicrosoftMailClientSecret();
  return Boolean(id && secret && !isPlaceholder(id) && !isPlaceholder(secret));
}

function maskSecret(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.length <= 4) return '••••';
  return `••••${v.slice(-4)}`;
}

export async function getAdminEmailOAuthSettings() {
  const row = await getPlatformEmailSettingsRow();
  const googleClientId = getGoogleMailClientId();
  const microsoftClientId = getMicrosoftMailClientId();

  return {
    googleClientId: (row.google_client_id || '').trim() || googleClientId || '',
    googleClientSecretSet: Boolean(getGoogleMailClientSecret()),
    googleClientSecretMasked: maskSecret(getGoogleMailClientSecret()),
    microsoftClientId: (row.microsoft_client_id || '').trim() || microsoftClientId || '',
    microsoftClientSecretSet: Boolean(getMicrosoftMailClientSecret()),
    microsoftClientSecretMasked: maskSecret(getMicrosoftMailClientSecret()),
    oauthPublicUrl:
      (row.oauth_public_url || '').trim() ||
      process.env.EMAIL_OAUTH_PUBLIC_URL?.trim() ||
      '',
  };
}

export async function saveAdminEmailOAuthSettings(payload = {}) {
  const existing = await getPlatformEmailSettingsRow();
  const googleClientId = String(payload.googleClientId ?? existing.google_client_id ?? '').trim();
  const microsoftClientId = String(payload.microsoftClientId ?? existing.microsoft_client_id ?? '').trim();
  const oauthPublicUrl = String(payload.oauthPublicUrl ?? existing.oauth_public_url ?? '').trim();

  let googleClientSecret = existing.google_client_secret || '';
  if (payload.googleClientSecret != null && String(payload.googleClientSecret).trim()) {
    googleClientSecret = String(payload.googleClientSecret).trim();
  }

  let microsoftClientSecret = existing.microsoft_client_secret || '';
  if (payload.microsoftClientSecret != null && String(payload.microsoftClientSecret).trim()) {
    microsoftClientSecret = String(payload.microsoftClientSecret).trim();
  }

  await db.query(
    `INSERT INTO platform_email_settings
      (id, google_client_id, google_client_secret, microsoft_client_id, microsoft_client_secret, oauth_public_url)
     VALUES (1, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       google_client_id = VALUES(google_client_id),
       google_client_secret = VALUES(google_client_secret),
       microsoft_client_id = VALUES(microsoft_client_id),
       microsoft_client_secret = VALUES(microsoft_client_secret),
       oauth_public_url = VALUES(oauth_public_url),
       updated_at = CURRENT_TIMESTAMP`,
    [googleClientId, googleClientSecret, microsoftClientId, microsoftClientSecret, oauthPublicUrl],
  );

  invalidatePlatformEmailSettingsCache();
  await getPlatformEmailSettingsRow();
  return getAdminEmailOAuthSettings();
}
