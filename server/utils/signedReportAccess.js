import crypto from 'crypto';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (matches duplicate inquiry window)

function reportSigningSecret() {
  return process.env.JWT_SECRET || '';
}

/**
 * HMAC access token for public homeowner report endpoints.
 * Bearer-of-code alone is not enough — clients must present exp + sig.
 */
export function signReportAccess(leadCode, ttlMs = DEFAULT_TTL_MS) {
  const secret = reportSigningSecret();
  const code = String(leadCode || '').trim();
  if (!secret || !code) return null;
  const exp = Date.now() + Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS);
  const sig = crypto.createHmac('sha256', secret).update(`report:${code}:${exp}`).digest('hex');
  return { exp, sig };
}

export function verifyReportAccess(leadCode, exp, sig) {
  const secret = reportSigningSecret();
  const code = String(leadCode || '').trim();
  if (!secret || !code || !exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`report:${code}:${expNum}`)
    .digest('hex');
  try {
    const a = Buffer.from(String(sig));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Append ?exp=&sig= to a relative or absolute report path. */
export function withReportAccessQuery(pathOrUrl, access) {
  if (!pathOrUrl || !access?.exp || !access?.sig) return pathOrUrl;
  const sep = String(pathOrUrl).includes('?') ? '&' : '?';
  return `${pathOrUrl}${sep}exp=${encodeURIComponent(access.exp)}&sig=${encodeURIComponent(access.sig)}`;
}

export function reportAccessQueryString(access, { download } = {}) {
  if (!access?.exp || !access?.sig) return download ? '?download=1' : '';
  const params = new URLSearchParams({
    exp: String(access.exp),
    sig: String(access.sig),
  });
  if (download) params.set('download', '1');
  return `?${params.toString()}`;
}

export function frontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5200';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

/** Deep link homeowners can open to view their solar report. */
export function buildHomeownerReportPageUrl(leadCode, access) {
  const base = frontendBaseUrl();
  const code = String(leadCode || '').trim();
  if (!code || !access?.exp || !access?.sig) return `${base}/solar-report`;
  const params = new URLSearchParams({
    leadCode: code,
    exp: String(access.exp),
    sig: String(access.sig),
  });
  return `${base}/solar-report?${params.toString()}`;
}
