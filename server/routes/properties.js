import express from 'express';
import { trackedFetch } from '../services/apiUsage.js';
import { cacheRentcastRecords, getCachedRentcastRecord } from '../services/rentcastCache.js';
import {
  getFallbackZipCoords,
  mapRentcastToListItem,
  filterPropertiesByQuery,
  retrievePropertyDetails,
  mockAddresses,
  buildGoogleSatelliteStaticUrl,
  fetchGoogleSatelliteImage,
} from '../services/propertyService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

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

  if (lat && lng) {
    center = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      name: zip ? `ZIP ${zip}` : `Map @ ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`
    };
  }

  if (zip && !(lat && lng) && isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
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
        const queryLat = lat || center.lat;
        const queryLng = lng || center.lng;
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
          list = filterPropertiesByQuery(list, { lat, lng, radius, polygon, singleFamily, minSavings, skipPaneled });

          let avgCenter = center;
          if (list.length > 0) {
            let sumLat = 0;
            let sumLng = 0;
            list.forEach((p) => {
              sumLat += p.lat;
              sumLng += p.lng;
            });
            avgCenter = {
              lat: sumLat / list.length,
              lng: sumLng / list.length,
              name: zip ? `ZIP Code ${zip}` : center.name
            };
          }
          console.log(`[RentCast Search API] Loaded ${list.length} property records.`);
          return res.json({ center: avgCenter, properties: list, total: list.length });
        }
      }
    } catch (err) {
      console.error('[RentCast Search API] Failed, falling back to mock cluster:', err);
    }
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
  res.json({ center, properties: list, total: list.length });
}));

// Coordinates property lookup (when user clicks anywhere on map/rooftop)
router.get('/lookup', asyncHandler(async (req, res) => {
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

  const details = await retrievePropertyDetails(targetId, lookupLat, lookupLng, preFetchedRecord);
  res.json(details);
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
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cached = getCachedRentcastRecord(id);
  const details = await retrievePropertyDetails(id, undefined, undefined, cached);
  res.json(details);
}));

export default router;
