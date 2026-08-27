import { trackedFetch } from './apiUsage.js';
import { cacheRentcastRecord } from './rentcastCache.js';

const isKeyValid = (key) => key && key.trim() !== '' && !key.toLowerCase().includes('your_');

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const LOCATION_TYPE_RANK = {
  ROOFTOP: 1,
  RANGE_INTERPOLATED: 2,
  GEOMETRIC_CENTER: 3,
  APPROXIMATE: 4
};

function parseCoord(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function isValidCoord(lat, lng) {
  return lat != null && lng != null && lat !== 0 && lng !== 0
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function coordsFromRentcast(prop) {
  if (!prop) return null;
  const lat = parseCoord(prop.latitude ?? prop.location?.latitude);
  const lng = parseCoord(prop.longitude ?? prop.location?.longitude);
  if (!isValidCoord(lat, lng)) return null;
  return { lat, lng, source: 'rentcast', rank: 3 };
}

function coordsFromSolarCenter(center) {
  if (!center) return null;
  const lat = parseCoord(center.latitude ?? center.lat);
  const lng = parseCoord(center.longitude ?? center.lng);
  if (!isValidCoord(lat, lng)) return null;
  return { lat, lng, source: 'google_solar', rank: 1 };
}

function coordsFromProvided(lat, lng) {
  const pLat = parseCoord(lat);
  const pLng = parseCoord(lng);
  if (!isValidCoord(pLat, pLng)) return null;
  return { lat: pLat, lng: pLng, source: 'provided', rank: 5 };
}

function coordsFromGeocodeResult(result) {
  if (!result?.geometry?.location) return null;
  const lat = parseCoord(result.geometry.location.lat);
  const lng = parseCoord(result.geometry.location.lng);
  if (!isValidCoord(lat, lng)) return null;
  const locationType = result.geometry.location_type || 'APPROXIMATE';
  const typeRank = LOCATION_TYPE_RANK[locationType] ?? 4;
  const types = result.types || [];
  const isPreciseType = types.includes('street_address')
    || types.includes('premise')
    || types.includes('subpremise');
  let baseRank = locationType === 'ROOFTOP' ? 2 : 3.5 + (typeRank - 1) * 0.1;
  if (!isPreciseType) baseRank += 0.5;
  return {
    lat,
    lng,
    source: 'geocode',
    locationType,
    formattedAddress: result.formatted_address || null,
    rank: baseRank
  };
}

/** True for "123 Main St, City, ST" — not ZIP-only or city-only queries. */
export function looksLikeStreetAddress(query) {
  const q = String(query || '').trim();
  if (!q) return false;
  if (/^\d{5}(-\d{4})?$/.test(q)) return false;
  return /^\d+[A-Za-z]?\s+[A-Za-z]/.test(q);
}

const STREET_SUFFIX_ALIASES = {
  court: 'ct',
  ct: 'ct',
  street: 'st',
  st: 'st',
  avenue: 'ave',
  ave: 'ave',
  boulevard: 'blvd',
  blvd: 'blvd',
  drive: 'dr',
  dr: 'dr',
  road: 'rd',
  rd: 'rd',
  lane: 'ln',
  ln: 'ln',
  place: 'pl',
  pl: 'pl',
  terrace: 'ter',
  ter: 'ter',
  circle: 'cir',
  cir: 'cir',
  highway: 'hwy',
  hwy: 'hwy',
  parkway: 'pkwy',
  pkwy: 'pkwy',
};

/**
 * Normalize "4 Chamberlin Court" → { number: "4", street: "chamberlin ct" }
 * so condo/dense neighborhoods don't accept a nearby different parcel.
 */
export function streetAddressKey(address) {
  const raw = String(address || '')
    .toLowerCase()
    .replace(/[#.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return null;

  const m = raw.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (!m) return null;

  const number = m[1];
  const tokens = m[2]
    .split(' ')
    .filter(Boolean)
    .filter((t) => !['nj', 'ny', 'pa', 'usa', 'us'].includes(t) && !/^\d{5}(-\d{4})?$/.test(t));

  // Drop trailing city/state noise after known street suffix when possible.
  let streetTokens = tokens.slice();
  let suffixIdx = -1;
  for (let i = 0; i < streetTokens.length; i += 1) {
    if (STREET_SUFFIX_ALIASES[streetTokens[i]]) suffixIdx = i;
  }
  if (suffixIdx >= 0) {
    streetTokens = streetTokens.slice(0, suffixIdx + 1);
  } else {
    // Keep first 1–3 tokens (street name) before city words.
    streetTokens = streetTokens.slice(0, Math.min(3, streetTokens.length));
  }

  streetTokens = streetTokens.map((t) => STREET_SUFFIX_ALIASES[t] || t);
  const street = streetTokens.join(' ').trim();
  if (!street) return null;
  return { number, street };
}

/** True when candidate parcel is the searched house (not a 0.1–0.2mi neighbor). */
export function isSameStreetProperty(queryAddress, candidateAddress) {
  const a = streetAddressKey(queryAddress);
  const b = streetAddressKey(candidateAddress);
  if (!a || !b) return false;
  if (a.number !== b.number) return false;
  if (a.street === b.street) return true;
  // Allow one-side containment for abbreviated vs full names already normalized.
  return a.street.includes(b.street) || b.street.includes(a.street);
}

/** Max drift from a ROOFTOP/parcel seed before we treat a candidate as the wrong building. */
export const MAX_PARCEL_DRIFT_METERS = 75;
export const MAX_SOLAR_DRIFT_METERS = 55;
/** Solar must be this close to a verified geocode/parcel before it wins over geocode. */
export const MAX_SOLAR_FROM_GEOCODE_METERS = 20;

export function buildCoordinatePropertyId(lat, lng, address = '') {
  const base = `coordinate-${Number(lat).toFixed(5)}-${Number(lng).toFixed(5)}`;
  const addr = String(address || '').trim();
  return addr ? `${base}__${encodeURIComponent(addr)}` : base;
}

export function parseCoordinatePropertyId(id) {
  const match = String(id || '').match(/^coordinate-(-?\d+\.\d+)-(-?\d+\.\d+)(?:__(.+))?$/);
  if (!match) return null;
  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
    address: match[3] ? decodeURIComponent(match[3]) : null,
  };
}

function isVerifiedGeocodeForQuery(query, geocoded) {
  if (!geocoded) return false;
  const locationType = geocoded.locationType || '';
  const preciseLocation =
    locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED';
  if (!preciseLocation) return false;
  return assertAddressMatchesSearch(query, geocoded.formattedAddress || query).ok;
}

/**
 * Pick map pin coords for a street-address search.
 * Verified geocode/RentCast beat Solar — Solar findClosest can snap to a neighbor
 * (e.g. 2308) when autocomplete seeds or interpolated geocodes land nearby.
 */
export function pickAddressSearchPinCoords({
  query,
  geocoded = null,
  rentcastCoords = null,
  solarCenter = null,
  provided = null,
}) {
  const q = String(query || '').trim();
  const geocodeVerified = isVerifiedGeocodeForQuery(q, geocoded);

  let safeProvided = provided;
  if (safeProvided && geocoded && !isWithinMeters(safeProvided, geocoded, MAX_PARCEL_DRIFT_METERS)) {
    safeProvided = null;
  }

  if (rentcastCoords && geocodeVerified && isWithinMeters(rentcastCoords, geocoded, MAX_PARCEL_DRIFT_METERS)) {
    return {
      lat: rentcastCoords.lat,
      lng: rentcastCoords.lng,
      source: rentcastCoords.source,
      locationType: geocoded.locationType || null,
      formattedAddress: geocoded.formattedAddress || rentcastCoords.formattedAddress || q,
    };
  }

  if (rentcastCoords && !geocoded) {
    return {
      lat: rentcastCoords.lat,
      lng: rentcastCoords.lng,
      source: rentcastCoords.source,
      locationType: null,
      formattedAddress: rentcastCoords.formattedAddress || q,
    };
  }

  if (geocodeVerified) {
    if (solarCenter && isWithinMeters(geocoded, solarCenter, MAX_SOLAR_FROM_GEOCODE_METERS)) {
      return {
        lat: solarCenter.lat,
        lng: solarCenter.lng,
        source: solarCenter.source,
        locationType: geocoded.locationType || null,
        formattedAddress: geocoded.formattedAddress || q,
      };
    }
    return {
      lat: geocoded.lat,
      lng: geocoded.lng,
      source: geocoded.source,
      locationType: geocoded.locationType || null,
      formattedAddress: geocoded.formattedAddress || q,
    };
  }

  const fallback = pickBestPropertyCoordinates([solarCenter, geocoded, rentcastCoords, safeProvided]);
  if (!fallback) return null;
  return {
    lat: fallback.lat,
    lng: fallback.lng,
    source: fallback.source,
    locationType: fallback.locationType || null,
    formattedAddress: fallback.formattedAddress || geocoded?.formattedAddress || q,
  };
}

export function isWithinMeters(a, b, maxMeters) {
  if (!a || !b || !isValidCoord(a.lat, a.lng) || !isValidCoord(b.lat, b.lng)) return false;
  return calculateDistanceMeters(a.lat, a.lng, b.lat, b.lng) <= maxMeters;
}

/**
 * Guardrail for street searches: parcel/result address must match the query.
 * Returns { ok: true } or { ok: false, reason, searched, resolved }.
 */
export function assertAddressMatchesSearch(searchedAddress, resolvedAddress) {
  const searched = String(searchedAddress || '').trim();
  const resolved = String(resolvedAddress || '').trim();
  if (!searched || !looksLikeStreetAddress(searched)) {
    return { ok: true };
  }
  if (!resolved || resolved === 'Not Available') {
    return { ok: false, reason: 'missing_resolved_address', searched, resolved: resolved || null };
  }
  if (!isSameStreetProperty(searched, resolved)) {
    return {
      ok: false,
      reason: 'street_mismatch',
      searched,
      resolved,
      searchedKey: streetAddressKey(searched),
      resolvedKey: streetAddressKey(resolved),
    };
  }
  return { ok: true, searched, resolved };
}

/**
 * Pick the most accurate coordinates from multiple candidate sources.
 * Priority: Google Solar building center > ROOFTOP geocode > RentCast > street geocode > click/provided.
 */
export function pickBestPropertyCoordinates(candidates = []) {
  const valid = candidates.filter((c) => c && isValidCoord(c.lat, c.lng));
  if (!valid.length) return null;

  valid.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const best = valid[0];
  return {
    lat: best.lat,
    lng: best.lng,
    source: best.source,
    locationType: best.locationType || null,
    formattedAddress: best.formattedAddress || null
  };
}

/**
 * Geocode a street address, preferring ROOFTOP / RANGE_INTERPOLATED results.
 */
export async function geocodeAddressCoordinates(addressStr) {
  if (!addressStr || addressStr === 'Not Available' || !isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const res = await trackedFetch('google_maps', url);
    if (!res.ok) return null;

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) return null;

    const ranked = results
      .map(coordsFromGeocodeResult)
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank);

    return ranked[0] || null;
  } catch (err) {
    console.error('[Coordinate Service] Geocode failed:', err.message || err);
    return null;
  }
}

/**
 * Fetch Google Solar buildingInsights center (rooftop centroid) for map pin placement.
 */
export async function fetchSolarBuildingCenter(lat, lng) {
  if (!isValidCoord(lat, lng) || !isKeyValid(process.env.GOOGLE_SOLAR_API_KEY)) {
    return null;
  }

  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${process.env.GOOGLE_SOLAR_API_KEY}`;
    const res = await trackedFetch('google_solar', url);
    if (!res.ok) return null;

    const data = await res.json();
    return coordsFromSolarCenter(data.center);
  } catch (err) {
    console.error('[Coordinate Service] Solar building center lookup failed:', err.message || err);
    return null;
  }
}

/**
 * Fetch the full RentCast property record for a street address.
 */
export async function fetchRentcastPropertyByAddress(address) {
  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  if (!address || !isKeyValid(rentcastApiKey)) return null;

  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`;
    const response = await trackedFetch('rentcast', url, {
      headers: { 'X-Api-Key': rentcastApiKey, accept: 'application/json' }
    });
    if (!response.ok) return null;
    const properties = await response.json();
    if (!Array.isArray(properties) || !properties[0]) return null;
    const prop = properties[0];
    // Never accept a different street number/name than the one we asked for.
    if (!isSameStreetProperty(address, prop.formattedAddress || prop.addressLine1)) {
      console.warn(
        `[Coordinate Service] RentCast address miss-match rejected: asked "${address}" got "${prop.formattedAddress}"`
      );
      return null;
    }
    cacheRentcastRecord(prop);
    return prop;
  } catch (err) {
    console.error('[Coordinate Service] RentCast address lookup failed:', err.message || err);
    return null;
  }
}

/**
 * Fetch nearest RentCast property for coordinates (same pattern as /properties/lookup).
 */
export async function fetchRentcastPropertyNearCoords(lat, lng, { radiusMiles = 0.2, limit = 1 } = {}) {
  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  if (!isValidCoord(lat, lng) || !isKeyValid(rentcastApiKey)) return null;

  try {
    const url = `https://api.rentcast.io/v1/properties?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radiusMiles)}&limit=${encodeURIComponent(limit)}`;
    const response = await trackedFetch('rentcast', url, {
      headers: { 'X-Api-Key': rentcastApiKey, accept: 'application/json' }
    });
    if (!response.ok) return null;
    const properties = await response.json();
    if (!Array.isArray(properties) || !properties[0]) return null;
    cacheRentcastRecord(properties[0]);
    return properties[0];
  } catch (err) {
    console.error('[Coordinate Service] RentCast near-coords lookup failed:', err.message || err);
    return null;
  }
}

/**
 * Fetch RentCast property coordinates by formatted address.
 */
export async function fetchRentcastCoordsByAddress(address) {
  const prop = await fetchRentcastPropertyByAddress(address);
  return coordsFromRentcast(prop);
}

/**
 * Resolve any searched street address to a rooftop-accurate home pin.
 * Priority: Google Solar building center (seeded from the exact parcel) >
 * ROOFTOP geocode > RentCast parcel > provided/search click.
 *
 * RentCast usage for street search:
 * 1) exact address lookup first (avoids wrong neighbor in dense areas)
 * 2) near-coords only as fallback, and only if the parcel street/number matches
 */
export async function resolveExactAddressSearch(query, { seedLat = null, seedLng = null } = {}) {
  const q = String(query || '').trim();
  if (!q) return null;

  const geocoded = await geocodeAddressCoordinates(q);
  const formatted = geocoded?.formattedAddress || q;
  const provided = coordsFromProvided(seedLat, seedLng);
  const safeProvided =
    provided && geocoded && !isWithinMeters(provided, geocoded, MAX_PARCEL_DRIFT_METERS)
      ? null
      : provided;
  const lookupSeed = geocoded || safeProvided;

  // Exact address first — near-coords can return a different house within ~0.2mi.
  let rentcastProp = await fetchRentcastPropertyByAddress(q);
  if (!rentcastProp && formatted && formatted !== q) {
    rentcastProp = await fetchRentcastPropertyByAddress(formatted);
  }

  if (!rentcastProp && lookupSeed) {
    const near = await fetchRentcastPropertyNearCoords(lookupSeed.lat, lookupSeed.lng);
    if (near && isSameStreetProperty(q, near.formattedAddress || near.addressLine1)) {
      rentcastProp = near;
    } else if (near) {
      console.warn(
        `[Address Search] Ignoring near-coords mismatch: searched "${q}" but nearest was "${near.formattedAddress}"`
      );
    }
  }

  // Never keep a parcel that doesn't match the searched street number/name.
  if (rentcastProp && !isSameStreetProperty(q, rentcastProp.formattedAddress || rentcastProp.addressLine1)) {
    console.warn(
      `[Address Search] Dropping RentCast mismatch: searched "${q}" vs "${rentcastProp.formattedAddress}"`
    );
    rentcastProp = null;
  }

  // If parcel centroid drifted far from a precise geocode, keep geocode identity.
  let rentcastCoords = coordsFromRentcast(rentcastProp);
  if (
    rentcastProp &&
    rentcastCoords &&
    geocoded &&
    (geocoded.locationType === 'ROOFTOP' || geocoded.locationType === 'RANGE_INTERPOLATED') &&
    !isWithinMeters(geocoded, rentcastCoords, MAX_PARCEL_DRIFT_METERS)
  ) {
    console.warn(
      `[Address Search] RentCast parcel too far from geocode (${Math.round(
        calculateDistanceMeters(geocoded.lat, geocoded.lng, rentcastCoords.lat, rentcastCoords.lng)
      )}m) for "${q}" — keeping searched address identity without neighbor snap`
    );
    // Keep ownership/record if street matched; still prefer geocode/solar for pin.
    rentcastCoords = null;
  }

  // Seed Solar from verified parcel/geocode — never from a drifted autocomplete pin.
  const seed = rentcastCoords || geocoded || safeProvided;

  let solarCenter = null;
  if (seed) {
    solarCenter = await fetchSolarBuildingCenter(seed.lat, seed.lng);
    if (solarCenter && !isWithinMeters(seed, solarCenter, MAX_SOLAR_DRIFT_METERS)) {
      console.warn(
        `[Address Search] Solar building center drifted ${Math.round(
          calculateDistanceMeters(seed.lat, seed.lng, solarCenter.lat, solarCenter.lng)
        )}m from seed for "${q}" — using seed coords`
      );
      solarCenter = null;
    }
    if (
      solarCenter &&
      geocoded &&
      isVerifiedGeocodeForQuery(q, geocoded) &&
      !isWithinMeters(geocoded, solarCenter, MAX_SOLAR_FROM_GEOCODE_METERS)
    ) {
      console.warn(
        `[Address Search] Solar snapped to neighbor (${Math.round(
          calculateDistanceMeters(geocoded.lat, geocoded.lng, solarCenter.lat, solarCenter.lng)
        )}m from geocode) for "${q}" — keeping geocode pin`
      );
      solarCenter = null;
    }
  }

  const best = pickAddressSearchPinCoords({
    query: q,
    geocoded,
    rentcastCoords,
    solarCenter,
    provided: safeProvided,
  });
  if (!best) return null;

  const formattedAddress =
    rentcastProp?.formattedAddress || geocoded?.formattedAddress || q;

  // Final hard gate: never return a different street than the user searched.
  const gate = assertAddressMatchesSearch(q, formattedAddress);
  if (!gate.ok && rentcastProp) {
    console.warn(
      `[Address Search] Final gate dropped RentCast identity: ${gate.reason} (${gate.searched} → ${gate.resolved})`
    );
    rentcastProp = null;
  }

  return {
    lat: best.lat,
    lng: best.lng,
    source: best.source,
    locationType: best.locationType || null,
    formattedAddress: rentcastProp?.formattedAddress || geocoded?.formattedAddress || q,
    rentcastProp,
    searchQuery: q,
    addressMatchVerified: assertAddressMatchesSearch(
      q,
      rentcastProp?.formattedAddress || geocoded?.formattedAddress || q
    ).ok,
  };
}

/**
 * Resolve the best available lat/lng for a property record.
 */
export async function resolvePropertyCoordinates({
  address,
  rentcastProp = null,
  providedLat,
  providedLng,
  solarCenter = null,
  geocodeIfNeeded = true
}) {
  const candidates = [
    coordsFromRentcast(rentcastProp),
    coordsFromSolarCenter(solarCenter),
    coordsFromProvided(providedLat, providedLng)
  ];

  if (geocodeIfNeeded && address && address !== 'Not Available' && !address.startsWith('Property at ')) {
    const geocoded = await geocodeAddressCoordinates(address);
    if (geocoded) candidates.push(geocoded);
  }

  const best = pickBestPropertyCoordinates(candidates);
  if (!best) return null;
  return best;
}

/**
 * Normalize coordinates on an enriched property/lead detail object (mutates detail).
 */
export async function normalizeDetailsCoordinates(detail, { rentcastProp = null, solarCenter = null } = {}) {
  if (!detail) return null;

  const resolved = await resolvePropertyCoordinates({
    address: detail.address,
    rentcastProp,
    providedLat: detail.lat,
    providedLng: detail.lng,
    solarCenter,
    geocodeIfNeeded: true
  });

  if (resolved) {
    detail.lat = resolved.lat;
    detail.lng = resolved.lng;
    detail.coordinateSource = resolved.source;
  }

  return resolved;
}

const COORD_FIX_THRESHOLD_METERS = 8;
const SOLAR_SNAP_THRESHOLD_METERS = 2;

function shouldPersistCoordinateFix(storedLat, storedLng, best, { force = false } = {}) {
  if (!best || !isValidCoord(best.lat, best.lng)) return false;
  if (force) return true;
  if (!isValidCoord(storedLat, storedLng)) return true;

  const distanceM = calculateDistanceMeters(storedLat, storedLng, best.lat, best.lng);
  if (best.source === 'google_solar' && distanceM > SOLAR_SNAP_THRESHOLD_METERS) return true;
  if (best.locationType === 'ROOFTOP' && distanceM > COORD_FIX_THRESHOLD_METERS) return true;
  return distanceM > COORD_FIX_THRESHOLD_METERS;
}

/**
 * Re-resolve lead coordinates from Solar / geocode / RentCast on read; update if materially wrong.
 */
export async function ensureLeadCoordinates(lead, { force = false } = {}) {
  const storedLat = parseCoord(lead?.latitude);
  const storedLng = parseCoord(lead?.longitude);

  if (!lead?.address || lead.address === 'Not Available' || lead.address.startsWith('Property at ')) {
    return { lat: storedLat, lng: storedLng, updated: false };
  }

  const [rentcast, geocoded] = await Promise.all([
    fetchRentcastCoordsByAddress(lead.address),
    geocodeAddressCoordinates(lead.address)
  ]);

  let seedLat = storedLat;
  let seedLng = storedLng;
  if (!isValidCoord(seedLat, seedLng)) {
    seedLat = geocoded?.lat ?? rentcast?.lat ?? null;
    seedLng = geocoded?.lng ?? rentcast?.lng ?? null;
  }

  let solarCenter = null;
  if (isValidCoord(seedLat, seedLng)) {
    solarCenter = await fetchSolarBuildingCenter(seedLat, seedLng);
  }

  const best = pickBestPropertyCoordinates([
    solarCenter,
    geocoded,
    rentcast,
    coordsFromProvided(storedLat, storedLng)
  ]);

  if (!best || !isValidCoord(best.lat, best.lng)) {
    return { lat: storedLat, lng: storedLng, updated: false };
  }

  const updated = shouldPersistCoordinateFix(storedLat, storedLng, best, { force });

  return {
    lat: best.lat,
    lng: best.lng,
    source: best.source,
    locationType: best.locationType || null,
    updated
  };
}
