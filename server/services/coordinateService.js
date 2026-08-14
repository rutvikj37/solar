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

function addressLookupVariants(address) {
  const variants = [address];
  const expanded = String(address || '')
    .replace(/\bCir\b/gi, 'Circle')
    .replace(/\bCt\b/gi, 'Court')
    .replace(/\bSt\b/gi, 'Street')
    .replace(/\bAve\b/gi, 'Avenue')
    .replace(/\bBlvd\b/gi, 'Boulevard')
    .replace(/\bDr\b/gi, 'Drive')
    .replace(/\bLn\b/gi, 'Lane')
    .replace(/\bRd\b/gi, 'Road')
    .replace(/\bPkwy\b/gi, 'Parkway');
  if (expanded && expanded !== address) variants.push(expanded);
  return variants.filter(Boolean);
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
    cacheRentcastRecord(properties[0]);
    return properties[0];
  } catch (err) {
    console.error('[Coordinate Service] RentCast address lookup failed:', err.message || err);
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
 */
export async function resolveExactAddressSearch(query, { seedLat = null, seedLng = null } = {}) {
  const q = String(query || '').trim();
  if (!q) return null;

  const geocoded = await geocodeAddressCoordinates(q);
  const formatted = geocoded?.formattedAddress || q;

  const tried = new Set();
  const tryAddress = async (addr) => {
    const key = String(addr || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || tried.has(key)) return null;
    tried.add(key);
    return fetchRentcastPropertyByAddress(addr);
  };

  let rentcastProp = await tryAddress(formatted);
  if (!rentcastProp) rentcastProp = await tryAddress(q);
  if (!rentcastProp) {
    for (const variant of addressLookupVariants(formatted)) {
      rentcastProp = await tryAddress(variant);
      if (rentcastProp) break;
    }
  }

  const rentcastCoords = coordsFromRentcast(rentcastProp);
  const provided = coordsFromProvided(seedLat, seedLng);
  const seed = rentcastCoords || geocoded || provided;

  let solarCenter = null;
  if (seed) {
    solarCenter = await fetchSolarBuildingCenter(seed.lat, seed.lng);
  }

  const best = pickBestPropertyCoordinates([
    solarCenter,
    geocoded,
    rentcastCoords,
    provided
  ]);
  if (!best) return null;

  return {
    lat: best.lat,
    lng: best.lng,
    source: best.source,
    locationType: best.locationType || null,
    formattedAddress: rentcastProp?.formattedAddress || geocoded?.formattedAddress || q,
    rentcastProp
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
