import { API_BASE } from '../config.js';

export const TOKEN_KEY = 'solar_token';
export const AUTH_CHANGED_EVENT = 'solar-auth-changed';

const LEGACY_TOKEN_KEY = 'token';

export const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin'];

const PUBLIC_EXACT = new Set([
  '/',
  '/about',
  '/contact',
  '/solar-report',
  '/for-installers',
  '/privacy',
  '/terms',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/action',
  '/get-solar-quote',
]);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isPublicPath(pathname = window.location.pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/proposal/')) return true;
  if (pathname.startsWith('/auth/')) return true;
  return false;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
}

function parseJwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Client-side expiry check (server still verifies the signature). No storage side effects. */
export function isTokenValid(token = getToken()) {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload) return false;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  clearAuthSessionCache();
  notifyAuthChanged();
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  clearAuthSessionCache();
  notifyAuthChanged();
}

function notifyAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** Short-lived auth profile cache so ProtectedRoute remounts don't flash a loader. */
let authSessionCache = null; // { token, role } | null
let authSessionInflight = null;

export function clearAuthSessionCache() {
  authSessionCache = null;
  authSessionInflight = null;
}

export function peekAuthSessionCache(token = getToken()) {
  if (!token || authSessionCache?.token !== token) return null;
  return authSessionCache;
}

export async function loadAuthSession() {
  const token = getToken();
  if (!token || !isTokenValid(token)) {
    if (token && !isTokenValid(token)) clearToken();
    clearAuthSessionCache();
    return null;
  }
  if (authSessionCache?.token === token) return authSessionCache;
  if (!authSessionInflight) {
    authSessionInflight = fetchMe()
      .then((data) => {
        if (!data) {
          clearAuthSessionCache();
          return null;
        }
        authSessionCache = { token, role: data.user?.role };
        return authSessionCache;
      })
      .finally(() => {
        authSessionInflight = null;
      });
  }
  return authSessionInflight;
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export function isAuthError(status) {
  return status === 401 || status === 403;
}

async function signOutFirebase() {
  try {
    const { ensureFirebaseAuth } = await import('./firebase.js');
    const authInstance = await ensureFirebaseAuth();
    const { signOut } = await import('firebase/auth');
    await signOut(authInstance);
  } catch {
    /* Firebase optional */
  }
}

/**
 * Wipe client auth and replace the current history entry with /login so Back
 * cannot restore an authenticated document as the current entry.
 */
export function logoutToLogin() {
  clearToken();
  void signOutFirebase();
  window.location.replace('/login');
}

/** Returns profile payload or null when token is missing/invalid (clears stale token). */
export async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (isAuthError(res.status) || res.status === 404) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Re-check auth after Back/Forward (including bfcache restore).
 * Call once at app startup.
 */
export function installAuthGuards() {
  const bounceIfUnauthenticated = () => {
    const token = getToken();
    if (token && !isTokenValid(token)) clearToken();
    if (isTokenValid()) return;
    if (isPublicPath(window.location.pathname)) return;
    window.location.replace('/login');
  };

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearAuthSessionCache();
    }
    bounceIfUnauthenticated();
  });

  window.addEventListener('popstate', bounceIfUnauthenticated);

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === LEGACY_TOKEN_KEY || event.key === null) {
      if (!getToken()) {
        clearAuthSessionCache();
        bounceIfUnauthenticated();
      }
    }
  });
}
