/**
 * Cookie / analytics consent helpers (localStorage).
 * Essential cookies are always on; analytics requires opt-in.
 */

export const COOKIE_CONSENT_KEY = 'str_cookie_consent_v1';
export const COOKIE_CONSENT_EVENT = 'str-cookie-consent-changed';

export const DEFAULT_CONSENT = {
  essential: true,
  analytics: false,
  decided: false,
  updatedAt: null,
};

export function readCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return { ...DEFAULT_CONSENT };
    const parsed = JSON.parse(raw);
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      decided: Boolean(parsed.decided),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

export function writeCookieConsent(partial) {
  const next = {
    ...readCookieConsent(),
    ...partial,
    essential: true,
    decided: true,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: next }));
  }
  return next;
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('str-open-cookie-preferences'));
  }
}

/** Whether non-essential / analytics scripts may run. */
export function analyticsAllowed(consent = readCookieConsent()) {
  return Boolean(consent?.decided && consent?.analytics);
}
