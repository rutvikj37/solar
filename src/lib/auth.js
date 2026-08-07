import { API_BASE } from '../config.js';

export const TOKEN_KEY = 'solar_token';

export const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export function isAuthError(status) {
  return status === 401 || status === 403;
}

export function logoutToLogin() {
  clearToken();
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
}

/** Returns profile payload or null when token is missing/invalid (clears stale token). */
export async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (isAuthError(res.status)) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
