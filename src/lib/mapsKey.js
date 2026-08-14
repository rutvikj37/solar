import { API_BASE } from '../config.js';

/**
 * Google Maps browser key — build-time only (never served from /api/config).
 * Set VITE_GOOGLE_MAPS_API_KEY in the frontend env / .env at repo root.
 */
export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

/** @deprecated Prefer getGoogleMapsApiKey(); kept for gradual call-site migration */
export async function fetchGoogleMapsApiKey() {
  const fromEnv = getGoogleMapsApiKey();
  if (fromEnv) return fromEnv;
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) return '';
    const data = await res.json();
    return String(data.googleMapsApiKey || '').trim();
  } catch {
    return '';
  }
}
