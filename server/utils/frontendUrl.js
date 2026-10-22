/**
 * Resolve the public app origin used in emails and redirects.
 * FRONTEND_URL may be comma-separated (CORS allows many origins); email links
 * must use a real browser-reachable origin — never prefer localhost in production.
 */

function normalizeOrigin(raw) {
  const s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin) {
  try {
    const host = new URL(origin).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/** Parse FRONTEND_URL into normalized origins (order preserved). */
export function parseFrontendOrigins(raw = process.env.FRONTEND_URL) {
  return String(raw || '')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}

/**
 * Public app base for email links, OAuth/Stripe redirects, etc.
 * APP_PUBLIC_URL (single origin) wins when set. Otherwise, from FRONTEND_URL:
 * - production: first non-localhost https origin, then any non-localhost; never localhost.
 * - other envs: first localhost origin, then the first entry.
 */
export function resolveFrontendBaseUrl(raw = process.env.FRONTEND_URL) {
  const explicit = normalizeOrigin(process.env.APP_PUBLIC_URL);
  if (explicit) return explicit;

  const origins = parseFrontendOrigins(raw);
  const isProd = process.env.NODE_ENV === 'production';

  const nonLocal = origins.filter((o) => !isLocalhostOrigin(o));
  const httpsNonLocal = nonLocal.filter((o) => o.startsWith('https:'));

  const pick = isProd
    ? httpsNonLocal[0] || nonLocal[0] || null
    : origins.find((o) => isLocalhostOrigin(o)) || origins[0] || 'http://localhost:5200';

  if (!pick) {
    // Production misconfig — fall back to brand URL rather than localhost.
    return 'https://spacetoroof.com';
  }
  return pick;
}
