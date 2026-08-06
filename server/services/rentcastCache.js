/**
 * In-memory cache of raw RentCast /v1/properties records.
 * Same payload shape as address/detail lookups — reuse is safe and does not
 * change enrichment (Google Solar, NREL, Tracerfy still run fresh).
 */

const TTL_MS = Number(process.env.RENTCAST_CACHE_TTL_MS) || 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = Number(process.env.RENTCAST_CACHE_MAX) || 2500;

const store = new Map(); // key -> { prop, expiresAt }

function touch(key, prop) {
  if (!key || !prop) return;
  if (store.size >= MAX_ENTRIES) {
    // Drop oldest ~10%
    const drop = Math.ceil(MAX_ENTRIES * 0.1);
    let i = 0;
    for (const k of store.keys()) {
      store.delete(k);
      if (++i >= drop) break;
    }
  }
  store.set(key, { prop, expiresAt: Date.now() + TTL_MS });
}

function read(key) {
  if (!key) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.prop;
}

function normalizeAddress(addr) {
  return String(addr || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cacheRentcastRecord(prop) {
  if (!prop || typeof prop !== 'object') return;
  const address = prop.formattedAddress || '';
  if (prop.id) {
    touch(`id:${prop.id}`, prop);
    touch(`app:rentcast-${prop.id}__${encodeURIComponent(address)}`, prop);
  }
  if (address) {
    touch(`addr:${normalizeAddress(address)}`, prop);
  }
}

export function cacheRentcastRecords(list) {
  if (!Array.isArray(list)) return;
  for (const prop of list) cacheRentcastRecord(prop);
}

/**
 * Resolve a cached RentCast record from an app property id or address.
 * @param {string} propertyId e.g. rentcast-abc__Encoded%20Address
 */
export function getCachedRentcastRecord(propertyId, addressHint = '') {
  if (!propertyId && !addressHint) return null;

  // Exact app id
  const byApp = read(`app:${propertyId}`);
  if (byApp) return byApp;

  if (propertyId && String(propertyId).startsWith('rentcast-')) {
    const parts = String(propertyId).split('__');
    const rentcastId = parts[0].slice('rentcast-'.length);
    const byId = read(`id:${rentcastId}`);
    if (byId) return byId;

    if (parts[1]) {
      try {
        const addr = decodeURIComponent(parts[1]);
        const byAddr = read(`addr:${normalizeAddress(addr)}`);
        if (byAddr) return byAddr;
      } catch (_) {
        /* ignore decode errors */
      }
    }
  }

  if (addressHint) {
    const byHint = read(`addr:${normalizeAddress(addressHint)}`);
    if (byHint) return byHint;
  }

  return null;
}
