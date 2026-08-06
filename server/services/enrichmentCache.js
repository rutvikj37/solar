/**
 * Cache full property enrichment results (Solar + contacts + scores).
 * Avoids re-running Google Solar / NREL / Tracerfy / Apollo on repeat pin clicks.
 */

const TTL_MS = Number(process.env.ENRICHMENT_CACHE_TTL_MS) || 12 * 60 * 60 * 1000; // 12h
const CONTACT_TTL_MS = Number(process.env.ENRICHMENT_CONTACT_TTL_MS) || 6 * 60 * 60 * 1000; // 6h
const MAX_ENTRIES = Number(process.env.ENRICHMENT_CACHE_MAX) || 1500;

const store = new Map(); // key -> { details, expiresAt, contactExpiresAt }

function roundCoord(n) {
  return Number(n).toFixed(5);
}

export function enrichmentCacheKey(id, lat, lng) {
  if (id && String(id).startsWith('rentcast-')) {
    const rentcastId = String(id).split('__')[0].slice('rentcast-'.length);
    if (rentcastId) return `rc:${rentcastId}`;
  }
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) && Number(lng)) {
    return `ll:${roundCoord(lat)},${roundCoord(lng)}`;
  }
  if (id) return `id:${id}`;
  return null;
}

function evictIfNeeded() {
  if (store.size < MAX_ENTRIES) return;
  const drop = Math.ceil(MAX_ENTRIES * 0.1);
  let i = 0;
  for (const k of store.keys()) {
    store.delete(k);
    if (++i >= drop) break;
  }
}

export function getCachedEnrichment(id, lat, lng) {
  const key = enrichmentCacheKey(id, lat, lng);
  if (!key) return null;
  const hit = store.get(key);
  if (!hit) return null;
  const now = Date.now();
  if (now > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  // Contact portion older than contact TTL → treat as miss so contacts refresh
  if (now > hit.contactExpiresAt) {
    store.delete(key);
    return null;
  }
  // Deep-ish clone via JSON to avoid callers mutating cache
  try {
    return JSON.parse(JSON.stringify(hit.details));
  } catch (_) {
    return hit.details;
  }
}

export function setCachedEnrichment(id, lat, lng, details) {
  if (!details || details.enrichmentMeta?.skipContacts) return;
  const key = enrichmentCacheKey(id, lat ?? details.lat, lng ?? details.lng);
  if (!key) return;
  evictIfNeeded();
  const now = Date.now();
  store.set(key, {
    details: JSON.parse(JSON.stringify(details)),
    expiresAt: now + TTL_MS,
    contactExpiresAt: now + CONTACT_TTL_MS
  });
}
