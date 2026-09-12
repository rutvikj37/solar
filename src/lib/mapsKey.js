import { API_BASE } from '../config.js';

let cachedKey = null;
let pendingFetch = null;

function isValidMapsKey(key) {
  const k = String(key || '').trim();
  return k.length > 10 && !k.toLowerCase().includes('your_');
}

/**
 * Sync read — Vite build-time env only (`VITE_GOOGLE_MAPS_API_KEY` in root `.env`).
 * Prefer restricting this key (and server GOOGLE_MAPS_API_KEY) by HTTP referrer in GCP.
 */
export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

/**
 * Resolve Maps browser key: Vite env first, then `GET /api/config`.
 * Server may omit the key unless Origin/Referer matches FRONTEND_URL (production).
 */
export async function resolveGoogleMapsApiKey() {
  const viteKey = getGoogleMapsApiKey();
  if (isValidMapsKey(viteKey)) return viteKey;
  if (cachedKey) return cachedKey;

  if (!pendingFetch) {
    pendingFetch = fetch(`${API_BASE}/api/config`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const key = String(data?.googleMapsApiKey || '').trim();
        cachedKey = isValidMapsKey(key) ? key : '';
        return cachedKey;
      })
      .catch(() => {
        cachedKey = '';
        return '';
      })
      .finally(() => {
        pendingFetch = null;
      });
  }

  return pendingFetch;
}

/** @deprecated Use resolveGoogleMapsApiKey() */
export async function fetchGoogleMapsApiKey() {
  return resolveGoogleMapsApiKey();
}
