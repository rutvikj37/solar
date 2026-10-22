import express from 'express';
import { trackedFetch } from '../services/apiUsage.js';
import { cacheRentcastRecord, cacheRentcastRecords, getCachedRentcastRecord } from '../services/rentcastCache.js';
import {
  getFallbackZipCoords,
  mapRentcastToListItem,
  filterPropertiesByQuery,
  retrievePropertyDetails,
  toLockedPreview,
  mockAddresses,
  buildGoogleSatelliteStaticUrl,
  fetchGoogleSatelliteImage,
  applyVerifiedSolarSummary,
} from '../services/propertyService.js';
import {
  getBuildingInsights,
  getCachedSummaries,
  isGoogleSolarConfigured,
  solarCacheKey,
  summarizeBuildingInsights,
  takeSolarFetchBudget,
} from '../services/solarInsightsCache.js';
import {
  allowMockProperties,
  PROPERTY_DATA_UNAVAILABLE,
  PROPERTY_DATA_NOT_FOUND,
  PROPERTY_DATA_UNAVAILABLE_CODE,
  PROPERTY_DATA_NOT_FOUND_CODE,
} from '../utils/mockProperties.js';
import { notifyAdminApiFailure } from '../services/adminApiAlert.js';
import {
  looksLikeStreetAddress,
  resolveExactAddressSearch,
  assertAddressMatchesSearch,
  isSameStreetProperty,
  geocodeAddressCoordinates,
  buildCoordinatePropertyId,
  parseCoordinatePropertyId,
} from '../services/coordinateService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { isMissingField, isPlaceholderOwnerName } from '../services/contactEnrichmentService.js';
import { buildRoofLayout } from '../services/roofLayout.js';
import { isWithinEnrichmentCooldown } from '../utils/enrichmentCooldown.js';
import db from '../db.js';

const router = express.Router();

/** Attach already-cached Google Solar summaries (no API spend). */
async function attachCachedSolarScores(list) {
  if (!Array.isArray(list) || !list.length) return list;
  const summaries = await getCachedSummaries(list);
  if (!summaries.size) return list;
  return list.map((p) => {
    const summary = summaries.get(solarCacheKey(p.lat, p.lng));
    return summary ? applyVerifiedSolarSummary(p, summary) : p;
  });
}

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

function coalesceEnrichedText(dbVal, freshVal) {
  if (!isMissingField(dbVal) && !isPlaceholderOwnerName(dbVal)) return dbVal;
  if (!isMissingField(freshVal) && !isPlaceholderOwnerName(freshVal)) return freshVal;
  return dbVal ?? freshVal ?? null;
}

function coalesceEnrichedContact(dbVal, freshVal) {
  if (!isMissingField(dbVal)) return dbVal;
  if (!isMissingField(freshVal)) return freshVal;
  return dbVal ?? freshVal ?? null;
}

function leadRecordIsSparse(existing) {
  if (!existing) return false;
  return (
    isPlaceholderOwnerName(existing.owner_name) &&
    isMissingField(existing.phone) &&
    isMissingField(existing.email)
  );
}

function enrichmentImproved(existing, details) {
  if (!existing || !details) return false;
  const ownerBetter =
    isPlaceholderOwnerName(existing.owner_name) &&
    !isPlaceholderOwnerName(details.propertyData?.ownerName);
  const phoneBetter = isMissingField(existing.phone) && !isMissingField(details.contact?.phone);
  const emailBetter = isMissingField(existing.email) && !isMissingField(details.contact?.email);
  const valueBetter =
    (Number(existing.property_value) || 0) < 10000 &&
    (() => {
      const raw = details.propertyData?.propertyValue || '';
      const n = parseFloat(String(raw).replace(/[$,]/g, ''));
      return !Number.isNaN(n) && n > 10000;
    })();
  return ownerBetter || phoneBetter || emailBetter || valueBetter;
}

async function respondWithLockedOrUnlockedDetails(req, res, id, lat, lng, rentcastRecord, options = {}) {
  const addressHint =
    options.addressHint || parseCoordinatePropertyId(id)?.address || null;
  const preview = await retrievePropertyDetails(id, lat, lng, rentcastRecord, {
    skipContacts: true,
    addressHint,
  });
  let existing = null;
  if (req.user?.id && preview?.address) {
    const { resolveWorkspaceContext } = await import('../utils/workspaceContext.js');
    const workspace = await resolveWorkspaceContext(req.user.id);
    const [rows] = await db.query(
      `SELECT id, user_id, owner_name, phone, phone_type, email, email_status, linkedin,
              mailing_address, property_value, owner_occupied, parcel_id, last_enriched_at
       FROM leads WHERE user_id = ? AND address = ? LIMIT 1`,
      [workspace.ownerUserId, preview.address]
    );
    existing = rows[0] || null;
  }
  if (existing) {
    let details = preview;
    const sparse =
      leadRecordIsSparse(existing) && !isWithinEnrichmentCooldown(existing.last_enriched_at);
    if (sparse) {
      console.log(`[Property Detail] Sparse saved lead #${existing.id} — refreshing enrichment`);
      try {
        details = await retrievePropertyDetails(id, lat, lng, rentcastRecord, {
          skipContacts: false,
          bypassCache: true,
          addressHint,
        });
      } finally {
        await db
          .query('UPDATE leads SET last_enriched_at = NOW() WHERE id = ?', [existing.id])
          .catch((err) => console.warn('[Property Detail] last_enriched_at update failed:', err.message || err));
      }
    }

    const ownerName = coalesceEnrichedText(existing.owner_name, details.propertyData?.ownerName);
    const phone = coalesceEnrichedContact(existing.phone, details.contact?.phone);
    const email = coalesceEnrichedContact(existing.email, details.contact?.email);
    const linkedIn = coalesceEnrichedContact(existing.linkedin, details.contact?.linkedIn);
    const phoneType = coalesceEnrichedContact(existing.phone_type, details.contact?.phoneType);
    const emailStatus = coalesceEnrichedContact(existing.email_status, details.contact?.emailStatus);
    const mailingAddress = coalesceEnrichedText(
      existing.mailing_address,
      details.propertyData?.mailingAddress,
    );
    const parcelNumber = coalesceEnrichedText(existing.parcel_id, details.propertyData?.parcelNumber);
    const ownerOccupied =
      existing.owner_occupied === 1
        ? 'Yes'
        : existing.owner_occupied === 0
          ? 'No'
          : details.propertyData?.ownerOccupied || null;
    const propertyValue = (() => {
      const dbNum = Number(existing.property_value) || 0;
      const fresh = details.propertyData?.propertyValue;
      if (dbNum > 10000) return `$${dbNum.toLocaleString('en-US')}`;
      if (!isMissingField(fresh)) return fresh;
      return dbNum > 0 ? `$${dbNum.toLocaleString('en-US')}` : null;
    })();

    if (sparse && enrichmentImproved(existing, details)) {
      const propValNum = (() => {
        const raw = propertyValue || '';
        const n = parseFloat(String(raw).replace(/[$,]/g, ''));
        return Number.isNaN(n) ? Number(existing.property_value) || 0 : n;
      })();
      const ownerOccupiedDb =
        ownerOccupied === 'Yes' ? 1 : ownerOccupied === 'No' ? 0 : existing.owner_occupied;
      try {
        await db.query(
          `UPDATE leads SET
             owner_name = ?, phone = ?, phone_type = ?, email = ?, email_status = ?,
             linkedin = ?, mailing_address = ?, parcel_id = ?, owner_occupied = ?,
             property_value = CASE WHEN ? > 10000 OR property_value IS NULL OR property_value < 10000 THEN ? ELSE property_value END
           WHERE id = ? AND user_id = ?`,
          [
            ownerName,
            phone,
            phoneType,
            email,
            emailStatus,
            linkedIn,
            mailingAddress,
            parcelNumber,
            ownerOccupiedDb,
            propValNum,
            propValNum,
            existing.id,
            existing.user_id,
          ],
        );
        console.log(`[Property Detail] Updated sparse lead #${existing.id} from refreshed enrichment`);
      } catch (updateErr) {
        console.warn('[Property Detail] Sparse lead refresh DB update failed:', updateErr.message || updateErr);
      }
    }

    return res.json({
      ...details,
      unlocked: true,
      leadId: existing.id,
      propertyData: {
        ...(details.propertyData || {}),
        ownerName,
        ownerOccupied,
        mailingAddress,
        propertyValue,
        parcelNumber,
      },
      contact: {
        phone,
        email,
        linkedIn,
        phoneType,
        emailStatus,
        confidenceScore:
          !isMissingField(phone) || !isMissingField(email)
            ? details.contact?.confidenceScore || 'Saved lead'
            : null,
      },
      enrichmentMeta: {
        ...(details.enrichmentMeta || {}),
        contactSource: sparse ? details.enrichmentMeta?.contactSource || 'refreshed' : 'lead-db',
        skipContacts: false,
      },
    });
  }
  return res.json({ ...toLockedPreview(preview), unlocked: false });
}

// 1. Geocoding Search Pincode & Clustered Coordinates Generator
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const {
    zip,
    lat,
    lng,
    radius,
    polygon: polygonRaw,
    limit: limitRaw,
    singleFamily,
    minSavings,
    skipPaneled
  } = req.query;

  let polygon = null;
  if (polygonRaw) {
    try {
      polygon = typeof polygonRaw === 'string' ? JSON.parse(polygonRaw) : polygonRaw;
    } catch (_) {
      polygon = null;
    }
  }

  const limit = Math.min(80, Math.max(15, parseInt(limitRaw, 10) || 60));

  if (!zip && !(lat && lng)) {
    return res.status(400).json({ error: 'ZIP code or lat/lng required' });
  }

  let center = null;
  let exactMatch = null;
  const hasPolygon = Array.isArray(polygon) && polygon.length >= 3;
  const isAddressSearch = looksLikeStreetAddress(zip) && !hasPolygon;

  if (isAddressSearch) {
    try {
      const resolved = await resolveExactAddressSearch(zip, { seedLat: lat, seedLng: lng });
      if (resolved) {
        const resolvedAddress = resolved.formattedAddress || zip;
        const matchGate = assertAddressMatchesSearch(zip, resolvedAddress);
        if (!matchGate.ok) {
          console.error(
            `[Address Search] Refusing mismatched resolve for "${zip}" → "${resolvedAddress}" (${matchGate.reason})`
          );
        } else {
          center = {
            lat: resolved.lat,
            lng: resolved.lng,
            name: resolvedAddress
          };
          if (resolved.rentcastProp) {
            const rcAddr = resolved.rentcastProp.formattedAddress || resolved.rentcastProp.addressLine1;
            if (isSameStreetProperty(zip, rcAddr)) {
              exactMatch = mapRentcastToListItem(resolved.rentcastProp);
            } else {
              console.warn(
                `[Address Search] Skipping RentCast list item mismatch: "${zip}" vs "${rcAddr}"`
              );
            }
          }
          if (!exactMatch) {
            exactMatch = {
              id: buildCoordinatePropertyId(resolved.lat, resolved.lng, resolvedAddress),
              lat: resolved.lat,
              lng: resolved.lng,
              address: resolvedAddress,
              propertyType: 'Unknown',
              yearBuilt: null,
              squareFootage: null,
              solarScore: null,
              estSavings: null,
              systemSize: null,
              panelsCount: null,
              scoreSource: null,
              existingSolar: 'Unknown',
              existingSolarLikely: false,
              ownerOccupied: false
            };
          }
          exactMatch.lat = resolved.lat;
          exactMatch.lng = resolved.lng;
          // Always label the pin with the verified searched property address.
          exactMatch.address = resolved.rentcastProp?.formattedAddress || resolvedAddress;
          exactMatch.isSearchMatch = true;
          exactMatch.searchQuery = zip;
          exactMatch.addressMatchVerified = true;
          console.log(`[Address Search] Rooftop pin ${resolved.source} @ ${resolved.lat}, ${resolved.lng} (${exactMatch.address})`);
        }
      }
    } catch (err) {
      console.error('[Address Search] Exact home resolve failed:', err.message || err);
    }

    // Geocode-only fallback — never radius-search neighbors for a street address.
    if (!exactMatch) {
      try {
        const geocoded = await geocodeAddressCoordinates(zip);
        const resolvedAddress = geocoded?.formattedAddress || zip;
        const matchGate = assertAddressMatchesSearch(zip, resolvedAddress);
        if (geocoded && matchGate.ok) {
          center = {
            lat: geocoded.lat,
            lng: geocoded.lng,
            name: resolvedAddress,
          };
          exactMatch = {
            id: buildCoordinatePropertyId(geocoded.lat, geocoded.lng, resolvedAddress),
            lat: geocoded.lat,
            lng: geocoded.lng,
            address: resolvedAddress,
            propertyType: 'Unknown',
            yearBuilt: null,
            squareFootage: null,
            solarScore: null,
            estSavings: null,
            systemSize: null,
            panelsCount: null,
            scoreSource: null,
            existingSolar: 'Unknown',
            existingSolarLikely: false,
            ownerOccupied: false,
            isSearchMatch: true,
            searchQuery: zip,
            addressMatchVerified: true,
          };
          console.log(`[Address Search] Geocode-only pin @ ${geocoded.lat}, ${geocoded.lng} (${resolvedAddress})`);
        }
      } catch (err) {
        console.error('[Address Search] Geocode fallback failed:', err.message || err);
      }
    }
  }

  if (lat && lng && !center && !isAddressSearch) {
    center = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      name: zip ? `ZIP ${zip}` : `Map @ ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`
    };
  }

  if (zip && !center && isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    try {
      console.log(`[Geocoding API] Querying coords for ZIP: ${zip}`);
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const response = await trackedFetch('google_maps', geoUrl);
      const geoData = await response.json();

      if (geoData.results && geoData.results[0]) {
        const loc = geoData.results[0].geometry.location;
        if (!center) {
          center = {
            lat: loc.lat,
            lng: loc.lng,
            name: geoData.results[0].formatted_address
          };
        }
        console.log(`[Geocoding API] Resolved successfully:`, center);
      }
    } catch (err) {
      console.error('[Geocoding API] Failed, falling back to deterministic coordinates:', err);
    }
  }

  if (!center && zip) {
    center = getFallbackZipCoords(zip);
  }
  if (!center) {
    return res.status(400).json({ error: 'Could not resolve map center' });
  }

  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  /** @type {'no_key'|'ok'|'empty'|'error'|'skipped'} */
  let rentcastStatus = 'skipped';
  if (!isKeyValid(rentcastApiKey)) {
    rentcastStatus = 'no_key';
  } else if (!(isAddressSearch && exactMatch)) {
    try {
      let rentcastUrl;
      const isNumericZip = /^\d{5}$/.test(zip);
      if (isNumericZip && !lat && !lng) {
        console.log(`[RentCast Search API] Querying ZIP: ${zip} limit=${limit}`);
        rentcastUrl = `https://api.rentcast.io/v1/properties?zipCode=${encodeURIComponent(zip)}&limit=${limit}`;
      } else {
        const queryLat = exactMatch ? center.lat : (lat || center.lat);
        const queryLng = exactMatch ? center.lng : (lng || center.lng);
        const radiusMiles = radius ? Math.max(0.1, parseFloat(radius) / 1609.34) : 3.5;
        console.log(`[RentCast Search API] Querying near ${queryLat},${queryLng} radius=${radiusMiles.toFixed(2)}mi limit=${limit}`);
        rentcastUrl = `https://api.rentcast.io/v1/properties?latitude=${encodeURIComponent(queryLat)}&longitude=${encodeURIComponent(queryLng)}&radius=${encodeURIComponent(radiusMiles.toFixed(2))}&limit=${limit}`;
      }

      const response = await trackedFetch('rentcast', rentcastUrl, {
        headers: {
          'X-Api-Key': rentcastApiKey,
          'accept': 'application/json'
        }
      });
      if (response.ok) {
        const properties = await response.json();
        if (Array.isArray(properties) && properties.length > 0) {
          cacheRentcastRecords(properties);

          let list = properties.map(mapRentcastToListItem).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
          list = filterPropertiesByQuery(list, {
            lat: exactMatch ? center.lat : lat,
            lng: exactMatch ? center.lng : lng,
            radius,
            polygon,
            singleFamily,
            minSavings,
            skipPaneled
          });

          if (exactMatch) {
            // Keep neighbors for map context, but never let one replace the searched home.
            list = list.filter(
              (p) => p.id !== exactMatch.id && !isSameStreetProperty(exactMatch.address, p.address)
            );
            list.unshift(exactMatch);
          }
          list = await attachCachedSolarScores(list);

          let responseCenter = center;
          if (!exactMatch && list.length > 0) {
            let sumLat = 0;
            let sumLng = 0;
            list.forEach((p) => {
              sumLat += p.lat;
              sumLng += p.lng;
            });
            responseCenter = {
              lat: sumLat / list.length,
              lng: sumLng / list.length,
              name: zip ? `ZIP Code ${zip}` : center.name
            };
          }
          console.log(`[RentCast Search API] Loaded ${list.length} property records.`);
          if (list.length === 0) {
            return res.json({
              center: responseCenter,
              properties: [],
              total: 0,
              matchedPropertyId: null,
              searchType: exactMatch ? 'address' : (/^\d{5}$/.test(zip) ? 'zip' : 'area'),
              searchQuery: isAddressSearch ? zip : null,
              addressMatchVerified: exactMatch?.addressMatchVerified === true,
              error: PROPERTY_DATA_NOT_FOUND,
              code: PROPERTY_DATA_NOT_FOUND_CODE,
            });
          }
          return res.json({
            center: responseCenter,
            properties: list,
            total: list.length,
            matchedPropertyId: exactMatch?.id || null,
            searchType: exactMatch ? 'address' : (/^\d{5}$/.test(zip) ? 'zip' : 'area'),
            searchQuery: isAddressSearch ? zip : null,
            addressMatchVerified: exactMatch?.addressMatchVerified === true,
          });
        }
        rentcastStatus = 'empty';
      } else {
        rentcastStatus = 'error';
        console.error(`[RentCast Search API] HTTP ${response.status} — no mock fallback`);
      }
    } catch (err) {
      rentcastStatus = 'error';
      console.error('[RentCast Search API] Failed — no mock fallback:', err);
    }
  }

  if (exactMatch) {
    [exactMatch] = await attachCachedSolarScores([exactMatch]);
    return res.json({
      center,
      properties: [exactMatch],
      total: 1,
      matchedPropertyId: exactMatch.id,
      searchType: 'address',
      searchQuery: isAddressSearch ? zip : null,
      addressMatchVerified: exactMatch?.addressMatchVerified === true,
    });
  }

  // Fallback mock properties around center (ALLOW_MOCK_PROPERTIES=1 only)
  if (!allowMockProperties()) {
    const providerDown = rentcastStatus === 'no_key' || rentcastStatus === 'error';
    if (providerDown) {
      void notifyAdminApiFailure({
        service: 'rentcast',
        operation: 'propertySearch',
        status: rentcastStatus === 'no_key' ? 503 : 502,
        errorMessage:
          rentcastStatus === 'no_key'
            ? 'RENTCAST_API_KEY missing or invalid'
            : 'RentCast search failed or returned error',
      });
    }
    return res.json({
      center,
      properties: [],
      total: 0,
      matchedPropertyId: null,
      searchType: /^\d{5}$/.test(zip) ? 'zip' : 'area',
      searchQuery: isAddressSearch ? zip : null,
      error: providerDown ? PROPERTY_DATA_UNAVAILABLE : PROPERTY_DATA_NOT_FOUND,
      code: providerDown ? PROPERTY_DATA_UNAVAILABLE_CODE : PROPERTY_DATA_NOT_FOUND_CODE,
      mockBlocked: true,
    });
  }

  const count = Math.min(limit, 60);
  let list = [];

  for (let i = 1; i <= count; i++) {
    const latDiff = Math.sin(i * 12.3) * 0.0025;
    const lngDiff = Math.cos(i * 15.6) * 0.003;
    const propId = `${zip || 'geo'}-${1000 + i}`;
    list.push({
      id: propId,
      lat: center.lat + latDiff,
      lng: center.lng + lngDiff,
      address: `${100 + i * 17} ${mockAddresses[i % mockAddresses.length]}, ZIP ${zip || ''}`.trim(),
      propertyType: i % 5 === 0 ? 'Condo' : 'Single Family',
      yearBuilt: 1980 + (i % 30),
      squareFootage: 1400 + i * 40,
      solarScore: null,
      estSavings: null,
      systemSize: null,
      panelsCount: null,
      scoreSource: null,
      existingSolar: 'Unknown',
      existingSolarLikely: false,
      ownerOccupied: i % 3 !== 0
    });
  }

  list = filterPropertiesByQuery(list, { lat, lng, radius, singleFamily, minSavings, skipPaneled });
  if (exactMatch) {
    list = list.filter(
      (p) => p.id !== exactMatch.id && !isSameStreetProperty(exactMatch.address, p.address)
    );
    list.unshift(exactMatch);
  }
  res.json({
    center,
    properties: list,
    total: list.length,
    matchedPropertyId: exactMatch?.id || null,
    searchType: exactMatch ? 'address' : (/^\d{5}$/.test(zip) ? 'zip' : 'area'),
    searchQuery: isAddressSearch ? zip : null,
    addressMatchVerified: exactMatch?.addressMatchVerified === true,
  });
}));

// Coordinates property lookup (when user clicks anywhere on map/rooftop)
/**
 * Verified solar scores for visible map items.
 * Body: { items: [{ id, lat, lng }] } (max 40). Cached results are free; uncached ones are
 * fetched from Google Solar up to SOLAR_SCORE_FETCH_PER_REQUEST and a per-user daily budget.
 */
// GET /api/properties/roof-layout?lat=&lng=&panels= — roof segments + panel layout polygons
router.get('/roof-layout', authenticateToken, asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  if (!isGoogleSolarConfigured()) {
    return res.json({ status: 'not_configured', message: 'Google Solar API key is not configured.' });
  }
  let result = await getBuildingInsights(lat, lng, { allowFetch: false });
  if (result.status === 'not_cached') {
    const { grant } = takeSolarFetchBudget(req.user.id, 1);
    if (!grant) {
      return res.json({ status: 'budget_exhausted', message: 'Daily roof-analysis limit reached. Try again tomorrow.' });
    }
    result = await getBuildingInsights(lat, lng, { allowFetch: true });
  }
  if (result.status === 'miss') {
    return res.json({ status: 'no_coverage', message: 'Google Solar has no roof model for this building.' });
  }
  if (result.status !== 'hit' || !result.data) {
    return res.json({ status: 'unavailable', message: 'Roof analysis is temporarily unavailable.' });
  }
  const layout = buildRoofLayout(result.data, { panelCount: req.query.panels });
  if (!layout) return res.json({ status: 'no_coverage', message: 'No roof segments available for this building.' });
  return res.json({ status: 'ok', layout });
}));

router.post('/solar-scores', authenticateToken, asyncHandler(async (req, res) => {
  const items = (Array.isArray(req.body?.items) ? req.body.items : [])
    .slice(0, 40)
    .map((it) => ({ id: String(it?.id || ''), lat: Number(it?.lat), lng: Number(it?.lng) }))
    .filter((it) => it.id && Number.isFinite(it.lat) && Number.isFinite(it.lng));

  const cached = await getCachedSummaries(items);
  const scores = {};
  const uncached = [];
  for (const it of items) {
    const key = solarCacheKey(it.lat, it.lng);
    if (cached.has(key)) {
      const s = cached.get(key);
      scores[it.id] = s ? { status: 'verified', ...s } : { status: 'no_coverage' };
    } else {
      uncached.push(it);
    }
  }

  const configured = isGoogleSolarConfigured();
  const perRequest = Math.max(0, Number(process.env.SOLAR_SCORE_FETCH_PER_REQUEST) || 8);
  const { grant, remaining } = configured
    ? takeSolarFetchBudget(req.user.id, Math.min(perRequest, uncached.length))
    : { grant: 0, remaining: 0 };

  const toFetch = uncached.slice(0, grant);
  const results = await Promise.all(toFetch.map((it) => getBuildingInsights(it.lat, it.lng)));
  toFetch.forEach((it, i) => {
    const r = results[i];
    const s = r.data ? summarizeBuildingInsights(r.data) : null;
    if (s) scores[it.id] = { status: 'verified', ...s };
    else if (r.status === 'miss') scores[it.id] = { status: 'no_coverage' };
    else scores[it.id] = { status: 'unavailable' };
  });
  for (const it of uncached.slice(grant)) {
    scores[it.id] = { status: configured ? 'pending' : 'not_configured' };
  }

  res.json({ scores, configured, budgetRemaining: remaining });
}));

router.get('/lookup', authenticateToken, asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Coordinates required' });

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  console.log(`[Properties Lookup API] Querying coords: ${latitude}, ${longitude}`);

  let rentcastId = null;
  let resolvedAddress = null;
  let preFetchedRecord = null;
  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;

  if (isKeyValid(rentcastApiKey)) {
    try {
      console.log(`[RentCast Coordinates Search] Finding property around: ${latitude}, ${longitude}`);
      const rentcastUrl = `https://api.rentcast.io/v1/properties?latitude=${latitude}&longitude=${longitude}&radius=0.05&limit=5`;
      const response = await trackedFetch('rentcast', rentcastUrl, {
        headers: {
          'X-Api-Key': rentcastApiKey,
          'accept': 'application/json'
        }
      });
      if (response.ok) {
        const properties = await response.json();
        if (Array.isArray(properties) && properties.length > 0) {
          // Prefer the closest parcel to the clicked rooftop (avoid dense-area neighbor swap).
          let best = null;
          let bestDist = Infinity;
          for (const prop of properties) {
            const pLat = parseFloat(prop.latitude);
            const pLng = parseFloat(prop.longitude);
            if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
            const dLat = (pLat - latitude) * 111320;
            const dLng = (pLng - longitude) * 111320 * Math.cos((latitude * Math.PI) / 180);
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (dist < bestDist) {
              bestDist = dist;
              best = prop;
            }
          }
          // ~45m: if nothing is that close, keep coordinate pin without forcing a wrong parcel.
          if (best && bestDist <= 45) {
            preFetchedRecord = best;
            rentcastId = preFetchedRecord.id;
            resolvedAddress = preFetchedRecord.formattedAddress;
            cacheRentcastRecord(preFetchedRecord);
            console.log(`[RentCast Coordinates Search] Resolved ID: ${rentcastId} (${Math.round(bestDist)}m)`);
          } else {
            console.warn(
              `[RentCast Coordinates Search] Nearest parcel ${best ? Math.round(bestDist) : 'n/a'}m away — not binding address`
            );
          }
        }
      }
    } catch (err) {
      console.error('[RentCast Coordinates Search] Error:', err);
    }
  }

  const targetId = rentcastId
    ? `rentcast-${rentcastId}__${encodeURIComponent(resolvedAddress)}`
    : `coordinate-${latitude.toFixed(5)}-${longitude.toFixed(5)}`;

  const lookupLat = preFetchedRecord ? parseFloat(preFetchedRecord.latitude) : latitude;
  const lookupLng = preFetchedRecord ? parseFloat(preFetchedRecord.longitude) : longitude;

  await respondWithLockedOrUnlockedDetails(req, res, targetId, lookupLat, lookupLng, preFetchedRecord);
}));

// Satellite image proxy for map property drawer (avoids client-side Static Maps key/referrer failures)
router.get('/satellite-image', authenticateToken, asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) {
    return res.status(400).json({ error: 'lat and lng query parameters required' });
  }
  if (!isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    return res.status(503).json({ error: 'Google Maps API key not configured' });
  }

  const imageOpts = { zoom: '20', size: '640x360', scale: '2', marker: true };
  const fallbackUrl = buildGoogleSatelliteStaticUrl(lat, lng, imageOpts);
  const image = await fetchGoogleSatelliteImage(lat, lng, imageOpts);

  if (image.error) {
    return res.status(503).json({
      error: 'Satellite imagery temporarily unavailable',
      reason: image.error,
      fallbackUrl: fallbackUrl || undefined,
    });
  }

  res.set('Content-Type', image.contentType);
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(image.buffer);
}));

// Single property details by ID
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cached = getCachedRentcastRecord(id);
  let providedLat;
  let providedLng;
  const parsedCoord = parseCoordinatePropertyId(id);
  if (parsedCoord) {
    providedLat = parsedCoord.lat;
    providedLng = parsedCoord.lng;
  }
  await respondWithLockedOrUnlockedDetails(req, res, id, providedLat, providedLng, cached, {
    addressHint: parsedCoord?.address || null,
  });
}));

export default router;
