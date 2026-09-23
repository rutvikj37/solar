/**
 * Debounced admin email alerts when critical vendor APIs fail.
 * Uses platform email (Resend / SendGrid / SES). Never includes API keys.
 */

const DEFAULT_ADMIN_ALERT_EMAIL = 'rutvik46@gmail.com';
/** Same service+error signature: at most one email per this window. */
const DEBOUNCE_MS = 20 * 60 * 1000;

/** @type {Map<string, number>} */
const lastSentAt = new Map();

const ALERTABLE_PROVIDERS = new Set([
  'rentcast',
  'google_maps',
  'google_solar',
  'tracerfy',
  'apollo',
  'verifalia',
  'nrel',
  'twilio',
]);

export function getAdminAlertEmail() {
  const raw = String(process.env.ADMIN_ALERT_EMAIL || '').trim();
  return raw || DEFAULT_ADMIN_ALERT_EMAIL;
}

function shouldAlertStatus(status) {
  if (status == null) return true; // network / timeout / throw
  const n = Number(status);
  if (!Number.isFinite(n)) return true;
  if (n === 401 || n === 403) return true;
  if (n >= 500) return true;
  return false;
}

function debounceKey(service, operation, statusOrCode) {
  return `${service}|${operation}|${statusOrCode ?? 'network'}`;
}

/**
 * Fire-and-forget admin alert. Safe to call from request paths.
 * Dynamic-imports platform email to avoid circular deps with apiUsage.
 * @param {{
 *   service: string,
 *   operation?: string,
 *   status?: number|null,
 *   errorMessage?: string,
 *   detail?: string,
 * }} opts
 */
export async function notifyAdminApiFailure(opts = {}) {
  try {
    const service = String(opts.service || 'unknown').trim() || 'unknown';
    if (!ALERTABLE_PROVIDERS.has(service)) return;

    const status = opts.status != null ? Number(opts.status) : null;
    if (opts.status != null && !shouldAlertStatus(status)) return;

    const operation = String(opts.operation || 'request').slice(0, 120);
    const statusOrCode = Number.isFinite(status) ? status : (opts.errorMessage || 'network');
    const key = debounceKey(service, operation, statusOrCode);
    const now = Date.now();
    const prev = lastSentAt.get(key) || 0;
    if (now - prev < DEBOUNCE_MS) return;
    lastSentAt.set(key, now);

    const { sendPlatformEmail, isPlatformEmailConfigured } = await import('./outreachDelivery.js');

    if (!isPlatformEmailConfigured()) {
      console.warn(
        `[adminApiAlert] Skipped (no platform email): ${service} ${operation} status=${statusOrCode}`,
      );
      return;
    }

    const to = getAdminAlertEmail();
    const ts = new Date().toISOString();
    const env = process.env.NODE_ENV || 'development';
    const errMsg = String(opts.errorMessage || '').slice(0, 500);
    const detail = String(opts.detail || '').slice(0, 500);

    const subject = `[SpaceToRoof] API alert: ${service} ${operation}`;
    const body = [
      'A critical vendor API failure was detected.',
      '',
      `Service: ${service}`,
      `Operation: ${operation}`,
      `HTTP status: ${Number.isFinite(status) ? status : 'n/a (network/timeout)'}`,
      `Error: ${errMsg || 'n/a'}`,
      detail ? `Detail: ${detail}` : null,
      `Timestamp: ${ts}`,
      `NODE_ENV: ${env}`,
      '',
      'This alert is debounced (~20 min per service+operation+status).',
      'API keys are never included in this message.',
    ]
      .filter(Boolean)
      .join('\n');

    await sendPlatformEmail(to, subject, body);
    console.log(`[adminApiAlert] Sent to ${to}: ${service} ${operation}`);
  } catch (err) {
    console.error('[adminApiAlert] Failed to send:', err.message || err);
  }
}

/** Clear debounce map (tests only). */
export function _resetAdminApiAlertDebounce() {
  lastSentAt.clear();
}
