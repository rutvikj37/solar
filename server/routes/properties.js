import express from 'express';
import { trackedFetch } from '../services/apiUsage.js';
import { cacheRentcastRecord, cacheRentcastRecords, getCachedRentcastRecord } from '../services/rentcastCache.js';
import {
  getFallbackZipCoords,
  mapRentcastToListItem,
  filterPropertiesByQuery,
  retrievePropertyDetails,
  enrichDetailsWithContacts,
  toLockedPreview,
  mockAddresses,
  buildGoogleSatelliteStaticUrl,
  fetchGoogleSatelliteImage,
} from '../services/propertyService.js';
import {
  looksLikeStreetAddress,
  resolveExactAddressSearch
} from '../services/coordinateService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db.js';

const router = express.Router();

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

async function respondWithLockedOrUnlockedDetails(req, res, id, lat, lng, rentcastRecord) {
  const preview = await retrievePropertyDetails(id, lat, lng, rentcastRecord, { skipContacts: true });
  let existing = null;
  if (req.user?.id && preview?.address) {
    const [rows] = await db.query(
      'SELECT id FROM leads WHERE user_id = ? AND address = ? LIMIT 1',
      [req.user.id, preview.address]
    );
    existing = rows[0] || null;
  }
  if (existing) {
    const full = await enrichDetailsWithContacts({ ...preview });
    return res.json({ ...full, unlocked: true, leadId: existing.id });
  }
  return res.json({ ...toLockedPreview(preview), unlocked: false });
}

// 1. Geocoding Search Pincode & Clustered Coordinates Generator
router.get('/', asyncHandler(async (req, res) => {
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
        center = {
          lat: resolved.lat,
          lng: resolved.lng,
          name: resolved.formattedAddress
        };
        if (resolved.rentcastProp) {
          exactMatch = mapRentcastToListItem(resolved.rentcastProp);
        } else {
          exactMatch = {
            id: `coordinate-${resolved.lat.toFixed(5)}-${resolved.lng.toFixed(5)}`,
            lat: resolved.lat,
            lng: resolved.lng,
            address: resolved.formattedAddress,
            propertyType: 'Unknown',
            yearBuilt: null,
            squareFootage: null,
            solarScore: 0,
            estSavings: 0,
            systemSize: '0 kW',
            panelsCount: 0,
            existingSolar: 'Unlikely',
            existingSolarLikely: false,
            ownerOccupied: false
          };
        }
        exactMatch.lat = resolved.lat;
        exactMatch.lng = resolved.lng;
        exactMatch.address = resolved.formattedAddress || exactMatch.address;
        exactMatch.isSearchMatch = true;
        console.log(`[Address Search] Rooftop pin ${resolved.source} @ ${resolved.lat}, ${resolved.lng} (${resolved.formattedAddress})`);
      }
    } catch (err) {
      console.error('[Address Search] Exact home resolve failed:', err.message || err);
    }
  }

  if (lat && lng && !center) {
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
  if (isKeyValid(rentcastApiKey)) {
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
            list = list.filter((p) => p.id !== exactMatch.id);
            list.unshift(exactMatch);
          }

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
          return res.json({
            center: responseCenter,
            properties: list,
            total: list.length,
            matchedPropertyId: exactMatch?.id || null,
            searchType: exactMatch ? 'address' : (/^\d{5}$/.test(zip) ? 'zip' : 'area')
          });
        }
      }
    } catch (err) {
      console.error('[RentCast Search API] Failed, falling back to mock cluster:', err);
    }
  }

  if (exactMatch) {
    return res.json({
      center,
      properties: [exactMatch],
      total: 1,
      matchedPropertyId: exactMatch.id,
      searchType: 'address'
    });
  }

  // Fallback mock properties around center
  const count = Math.min(limit, 60);
  let list = [];

  for (let i = 1; i <= count; i++) {
    const latDiff = Math.sin(i * 12.3) * 0.0025;
    const lngDiff = Math.cos(i * 15.6) * 0.003;
    const propId = `${zip || 'geo'}-${1000 + i}`;
    const solarScore = Math.floor(65 + (Math.sin(i * 5) + 1) * 17.5);
    const estSavings = Math.floor(20000 + (Math.cos(i * 4) + 1) * 15000);
    const kwSize = (5 + (i % 8) * 1.8).toFixed(1);
    const panelsCount = Math.ceil(parseFloat(kwSize) * 2.8);
    const existingSolarLikely = i % 8 === 0;

    list.push({
      id: propId,
      lat: center.lat + latDiff,
      lng: center.lng + lngDiff,
      address: `${100 + i * 17} ${mockAddresses[i % mockAddresses.length]}, ZIP ${zip || ''}`.trim(),
      propertyType: i % 5 === 0 ? 'Condo' : 'Single Family',
      yearBuilt: 1980 + (i % 30),
      squareFootage: 1400 + i * 40,
      solarScore,
      estSavings,
      systemSize: `${kwSize} kW`,
      panelsCount,
      existingSolar: existingSolarLikely ? 'Possible (list heuristic)' : 'Unlikely',
      existingSolarLikely,
      ownerOccupied: i % 3 !== 0
    });
  }

  list = filterPropertiesByQuery(list, { lat, lng, radius, singleFamily, minSavings, skipPaneled });
  if (exactMatch) {
    list = list.filter((p) => p.id !== exactMatch.id);
    list.unshift(exactMatch);
  }
  res.json({
    center,
    properties: list,
    total: list.length,
    matchedPropertyId: exactMatch?.id || null,
    searchType: exactMatch ? 'address' : (/^\d{5}$/.test(zip) ? 'zip' : 'area')
  });
}));

// Coordinates property lookup (when user clicks anywhere on map/rooftop)
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
      const rentcastUrl = `https://api.rentcast.io/v1/properties?latitude=${latitude}&longitude=${longitude}&radius=0.2&limit=1`;
      const response = await trackedFetch('rentcast', rentcastUrl, {
        headers: {
          'X-Api-Key': rentcastApiKey,
          'accept': 'application/json'
        }
      });
      if (response.ok) {
        const properties = await response.json();
        if (Array.isArray(properties) && properties[0]) {
          preFetchedRecord = properties[0];
          rentcastId = preFetchedRecord.id;
          resolvedAddress = preFetchedRecord.formattedAddress;
          cacheRentcastRecord(preFetchedRecord);
          console.log(`[RentCast Coordinates Search] Resolved ID: ${rentcastId}`);
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
  const coordMatch = String(id).match(/^coordinate-(-?\d+\.\d+)-(-?\d+\.\d+)$/);
  if (coordMatch) {
    providedLat = coordMatch[1];
    providedLng = coordMatch[2];
  }
  await respondWithLockedOrUnlockedDetails(req, res, id, providedLat, providedLng, cached);
}));

export default router;
