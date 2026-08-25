/** API base URL for the SpaceToRoof backend. */

function normalizeBase(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '');
}

/**
 * Resolve API origin.
 * On spacetoroof.com always use same-origin so stale builds that baked
 * solarx.live /api_call cannot break login after the domain move.
 */
export function resolveApiBase() {
  const fromEnv = normalizeBase(import.meta.env.VITE_API_URL);

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.replace(/^www\./, '');
    if (host === 'spacetoroof.com') {
      return window.location.origin;
    }
  }

  if (fromEnv && !/solarx\.live/i.test(fromEnv)) {
    return fromEnv;
  }

  return 'http://localhost:5002';
}

export const API_BASE = resolveApiBase();

export default API_BASE;
