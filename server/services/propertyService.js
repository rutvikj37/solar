import { enrichWithNrel } from './nrel.js';
import { trackedFetch } from './apiUsage.js';
import {
  cacheRentcastRecord,
  getCachedRentcastRecord
} from './rentcastCache.js';
import { getCachedEnrichment, setCachedEnrichment } from './enrichmentCache.js';
import {
  standardizeAddress,
  isCorporateOwner,
  resolveCorporateOwner,
  validateEmailWithVerifalia,
  lookupPhoneWithTwilio,
  isMissingField,
  hasAnyContact,
  scoreContactQuality,
  emptyContactDetails,
  enrichOwnerContacts
} from './contactEnrichmentService.js';
import { resolvePropertyCoordinates } from './coordinateService.js';

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

/** Google Maps Static API satellite rooftop URL (server-side key). */
export function buildGoogleSatelliteStaticUrl(lat, lng, options = {}) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!isKeyValid(key) || Number.isNaN(nLat) || Number.isNaN(nLng) || (!nLat && !nLng)) {
    return null;
  }
  const {
    zoom = '20',
    size = '640x360',
    scale = '2',
    marker = false
  } = options;
  const params = new URLSearchParams({
    center: `${nLat},${nLng}`,
    zoom: String(zoom),
    size: String(size),
    maptype: 'satellite',
    scale: String(scale),
    key
  });
  if (marker) {
    params.set('markers', `color:0xFF3B30|${nLat},${nLng}`);
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Fetch satellite PNG/JPEG bytes from Google Static Maps for embedding in proposals. */
export async function fetchGoogleSatelliteImage(lat, lng, options = {}) {
  const url = buildGoogleSatelliteStaticUrl(lat, lng, options);
  if (!url) return { error: 'missing_key_or_coords' };
  try {
    const upstream = await trackedFetch('google_maps', url);
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.warn(`[Static Maps] Upstream HTTP ${upstream.status} for ${lat},${lng}: ${detail.slice(0, 160)}`);
      return { error: 'upstream_failed', status: upstream.status };
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      const detail = await upstream.text().catch(() => '');
      console.warn(`[Static Maps] Non-image response for ${lat},${lng}: ${detail.slice(0, 160)}`);
      return { error: 'not_image' };
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length) return { error: 'empty_response' };
    return { buffer, contentType: contentType.split(';')[0].trim() || 'image/png' };
  } catch (err) {
    console.warn(`[Static Maps] Fetch error for ${lat},${lng}:`, err.message || err);
    return { error: 'fetch_error', detail: err.message };
  }
}

export const mockAddresses = [
  'Oakridge Estates Pkwy', 'Sunset Boulevard', 'Lakeshore Drive',
  'Pine Avenue', 'Maple Road', 'Cedar Court', 'Hilltop Lane'
];

export const mockOwners = [
  'Mark Henderson', 'Sarah Lundberg', 'Marcus Chen', 'Elena Kovic',
  'Bill Thompson', 'David Vance', 'Rachel Green', 'Bruce Wayne'
];

export function getFallbackZipCoords(zip) {
  const baseZips = {
    '90210': { lat: 34.0736, lng: -118.4004, name: 'Beverly Hills' },
    '94107': { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    '90025': { lat: 34.0450, lng: -118.4410, name: 'West Los Angeles' },
    '10001': { lat: 40.7501, lng: -73.9996, name: 'New York' },
    '95112': { lat: 37.3382, lng: -121.8863, name: 'San Jose' }
  };

  if (baseZips[zip]) return baseZips[zip];

  let hash = 0;
  for (let i = 0; i < zip.length; i++) {
    hash = zip.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (Math.abs(hash) % 200 - 100) * 0.002;
  const lngOffset = (Math.abs(hash >> 2) % 200 - 100) * 0.002;

  return {
    lat: 34.0522 + latOffset,
    lng: -118.2437 + lngOffset,
    name: `Sector ${zip}`
  };
}

export function hashString(str) {
  let idHash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    idHash = s.charCodeAt(i) + ((idHash << 5) - idHash);
  }
  return Math.abs(idHash);
}

export function isSingleFamilyType(propertyType) {
  if (!propertyType) return false;
  const t = String(propertyType).toLowerCase();
  return (
    t.includes('single') ||
    t.includes('sfr') ||
    t === 'house' ||
    t.includes('residential') ||
    t.includes('detached')
  );
}

export function parseMinSavingsThreshold(minSavings) {
  if (!minSavings || minSavings === 'Any') return 0;
  const n = parseInt(String(minSavings).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function looksPaneledExistingSolar(existingSolar) {
  if (!existingSolar) return false;
  const s = String(existingSolar).toLowerCase();
  if (s === 'no' || s.includes('no panels') || s === 'unlikely' || s === 'unknown') return false;
  return s.includes('likely') || s.includes('possible') || s.includes('yes') || s.includes('detected') || s.includes('existing');
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function mapRentcastToListItem(prop) {
  const propIdStr = prop.id || '';
  const idHash = hashString(propIdStr || prop.formattedAddress);
  const propertyType = prop.propertyType || prop.features?.propertyType || 'Unknown';
  const sqFt = prop.squareFootage || prop.features?.livingArea || 0;
  const solarScore = Math.min(99, Math.floor(68 + (idHash % 7) * 4 + Math.min(10, (sqFt || 0) / 400)));
  const sizeKw = (5 + (idHash % 7) * 1.5).toFixed(1);
  const estSavings = Math.floor(parseFloat(sizeKw) * 1450 * 0.18 * 25);
  const existingSolarLikely = (idHash % 8 === 0) || (prop.features && prop.features.hasSolar === true);
  const existingSolar = existingSolarLikely ? 'Possible (list heuristic)' : 'Unlikely';

  return {
    id: `rentcast-${prop.id}__${encodeURIComponent(prop.formattedAddress || '')}`,
    lat: parseFloat(prop.latitude),
    lng: parseFloat(prop.longitude),
    address: prop.formattedAddress,
    propertyType,
    yearBuilt: prop.yearBuilt || null,
    squareFootage: sqFt || null,
    solarScore,
    estSavings,
    systemSize: `${sizeKw} kW`,
    panelsCount: Math.ceil(parseFloat(sizeKw) * 2.8),
    existingSolar,
    existingSolarLikely: !!existingSolarLikely,
    ownerOccupied: prop.ownerOccupied === true
  };
}

export function isPointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return true;
  const x = point.lat;
  const y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat ?? polygon[i][0];
    const yi = polygon[i].lng ?? polygon[i][1];
    const xj = polygon[j].lat ?? polygon[j][0];
    const yj = polygon[j].lng ?? polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function filterPropertiesByQuery(list, { lat, lng, radius, polygon, singleFamily, minSavings, skipPaneled }) {
  let out = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (Array.isArray(polygon) && polygon.length >= 3) {
    out = out.filter((p) => isPointInPolygon(p, polygon));
  } else if (lat && lng && radius) {
    const radiusMeters = parseFloat(radius);
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    if (radiusMeters > 0 && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      out = out.filter((p) => calculateDistance(centerLat, centerLng, p.lat, p.lng) <= radiusMeters);
    }
  }

  if (singleFamily === true || singleFamily === 'true' || singleFamily === '1') {
    out = out.filter((p) => isSingleFamilyType(p.propertyType));
  }

  const minSav = parseMinSavingsThreshold(minSavings);
  if (minSav > 0) {
    out = out.filter((p) => (p.estSavings || 0) >= minSav);
  }

  if (skipPaneled === true || skipPaneled === 'true' || skipPaneled === '1') {
    out = out.filter((p) => !p.existingSolarLikely && !looksPaneledExistingSolar(p.existingSolar));
  }

  return out;
}

export function attachLeadScore(result, { solarScore, panelCount, propVal, annualSunshineHours, totalRoofAreaSqFt }) {
  const propertyDetails = result.propertyData || {};
  const contactDetails = result.contact || {};
  const contactAvailabilityScore = scoreContactQuality(contactDetails, propertyDetails.ownerName) * 12;
  const leadScore = Math.floor(
    (solarScore * 0.3) +
    ((propertyDetails.ownerOccupied === 'Yes' ? 100 : propertyDetails.ownerOccupied === 'No' ? 50 : 40) * 0.2) +
    ((propVal > 500000 ? 100 : propVal > 0 ? 70 : 40) * 0.2) +
    ((panelCount > 25 ? 100 : panelCount > 0 ? 60 : 35) * 0.2) +
    (Math.min(100, contactAvailabilityScore) * 0.1)
  );

  const sunlightExposureScore = annualSunshineHours > 0
    ? Math.min(100, Math.round((annualSunshineHours / 2200) * 100))
    : (solarScore > 0 ? Math.min(100, solarScore) : 0);
  const roofSizeScore = totalRoofAreaSqFt > 0
    ? Math.min(100, Math.round(totalRoofAreaSqFt / 30))
    : 0;
  const propertyValueScore = propVal > 600000 ? 95 : propVal > 350000 ? 80 : propVal > 0 ? 65 : 0;

  let leadLabel = 'Insufficient Data';
  let leadSummary = 'Live enrichment is incomplete for this property. Try another pin or wait for provider data.';
  if (leadScore >= 85) {
    leadLabel = 'Excellent Candidate';
    leadSummary = 'Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.';
  } else if (leadScore >= 70) {
    leadLabel = 'Strong Candidate';
    leadSummary = 'Good roof and sunlight profile with solid property indicators from live data sources.';
  } else if (leadScore >= 55) {
    leadLabel = 'Moderate Candidate';
    leadSummary = 'Some solar potential exists, but roof, value, or contact signals are mixed.';
  } else if (leadScore > 0) {
    leadLabel = 'Low Priority';
    leadSummary = 'Limited solar potential or incomplete owner/contact data from live providers.';
  }

  result.aiLeadScore = {
    overall: leadScore,
    label: leadLabel,
    summary: leadSummary,
    breakdown: {
      solarSuitability: solarScore || 0,
      roofSize: roofSizeScore,
      sunlightExposure: sunlightExposureScore,
      propertyValue: propertyValueScore,
      ownerOccupied: propertyDetails.ownerOccupied === 'Yes' ? 100 : propertyDetails.ownerOccupied === 'No' ? 50 : 0,
      contactAvailability: Math.min(100, Math.max(0, contactAvailabilityScore))
    }
  };
  return result;
}

export async function enrichDetailsWithContacts(details) {
  if (!details) return details;
  const locationInfo = details._locationInfo || {
    standardized: details.address || '',
    city: '',
    state: '',
    zip: ''
  };
  const propertyDetails = { ...(details.propertyData || {}) };

  const contactEnrichment = await enrichOwnerContacts({
    address: details.address,
    locationInfo,
    propertyDetails
  });

  details.propertyData = contactEnrichment.propertyDetails;
  let phoneType = contactEnrichment.phoneType;
  let emailStatus = 'Not Available';
  const contactDetails = { ...contactEnrichment.contactDetails };

  if (!isMissingField(contactDetails.email)) {
    emailStatus = await validateEmailWithVerifalia(contactDetails.email);
  }
  if (!isMissingField(contactDetails.phone) && phoneType === 'Not Available') {
    phoneType = await lookupPhoneWithTwilio(contactDetails.phone);
  }

  details.contact = {
    ...contactDetails,
    emailStatus,
    phoneType
  };
  details.enrichmentMeta = {
    ...(details.enrichmentMeta || {}),
    contactSource: contactEnrichment.contactSource,
    contactComplete: contactEnrichment.contactComplete,
    missingFields: contactEnrichment.missingFields,
    skipContacts: false,
    dataSources: {
      ...(details.enrichmentMeta?.dataSources || {}),
      contact: contactEnrichment.contactSource || 'unavailable'
    }
  };

  const solarScore = details.solarScore || 0;
  const panelCount = details.solar?.estimatedPanels || 0;
  const propVal = (() => {
    const raw = details.propertyData?.propertyValue || '';
    const n = parseFloat(String(raw).replace(/[$,]/g, ''));
    return Number.isFinite(n) ? n : 0;
  })();
  const annualSunshineHours = (() => {
    const raw = details.solar?.annualSunlight || '';
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const totalRoofAreaSqFt = (() => {
    const raw = details.solar?.totalRoofArea || '';
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  })();

  attachLeadScore(details, { solarScore, panelCount, propVal, annualSunshineHours, totalRoofAreaSqFt });
  delete details._locationInfo;
  setCachedEnrichment(details.id, details.lat, details.lng, details);
  return details;
}

export async function retrievePropertyDetails(id, providedLat, providedLng, rentcastRecord = null, options = {}) {
  const skipContacts = !!options.skipContacts;
  const bypassCache = !!options.bypassCache;

  let address = '';
  let lat = parseFloat(providedLat) || 0;
  let lng = parseFloat(providedLng) || 0;
  let propertyType = 'Not Available';
  let yearBuilt = 'Not Available';
  let livingArea = 'Not Available';
  let lotSize = 'Not Available';
  let stories = 'Not Available';
  let locationInfo = { standardized: '', city: '', state: '', zip: '' };

  if (!bypassCache && !skipContacts) {
    const cached = getCachedEnrichment(id, lat, lng);
    if (cached) {
      console.log(`[Enrichment Cache] HIT for ${id}`);
      return cached;
    }
  }

  let solarScore = 0;
  let savings = 0;
  let sizeKw = '0';
  let panelCount = 0;
  let propVal = 0;

  let solarDetails = {
    roofOutline: 'Not Available',
    totalRoofArea: 'Not Available',
    usableRoofArea: 'Not Available',
    orientation: 'Not Available',
    pitch: 'Not Available',
    annualSunlight: 'Not Available',
    shading: 'Not Available',
    potential: 'Not Available',
    recommendedSize: 'Not Available',
    estimatedPanels: 0,
    annualProduction: 'Not Available',
    twentyFiveYearSavings: 'Not Available',
    existingSolar: 'Not Available',
    imageryDate: 'Not Available',
    imageryQuality: 'Not Available',
    buildingFootprint: 'Not Available',
    panelWattage: 'Not Available',
    carbonOffset: 'Not Available',
    roofSegments: 'Not Available'
  };
  let propertyDetails = {};
  let contactDetails = {};
  let rentcastPropUsed = rentcastRecord || null;

  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  if (id.startsWith('rentcast-') && isKeyValid(rentcastApiKey)) {
    const parts = id.split('__');
    const rentcastId = parts[0].split('rentcast-')[1];
    let addressQuery = parts[1] ? decodeURIComponent(parts[1]) : rentcastId.replace(/-/g, ' ');

    try {
      let prop = rentcastRecord || getCachedRentcastRecord(id, addressQuery);
      if (!prop) {
        console.log(`[RentCast Detail API] Cache miss — fetching details for address: ${addressQuery}`);
        const detailUrl = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(addressQuery)}`;
        const response = await trackedFetch('rentcast', detailUrl, {
          headers: {
            'X-Api-Key': rentcastApiKey,
            'accept': 'application/json'
          }
        });
        if (response.ok) {
          const propertiesList = await response.json();
          if (Array.isArray(propertiesList) && propertiesList[0]) {
            prop = propertiesList[0];
            cacheRentcastRecord(prop);
          }
        }
      } else {
        console.log(`[RentCast Detail API] Using cached/pre-fetched record for: ${addressQuery}`);
      }

      if (prop) {
        cacheRentcastRecord(prop);
        rentcastPropUsed = prop;
        address = prop.formattedAddress;
        lat = parseFloat(prop.latitude);
        lng = parseFloat(prop.longitude);

        if (prop.city && prop.state && prop.zipCode) {
          locationInfo = {
            standardized: address,
            city: prop.city,
            state: prop.state,
            zip: prop.zipCode
          };
          console.log('[Address Standardization] Skipped Geocode — RentCast city/state/zip present');
        } else {
          locationInfo = await standardizeAddress(address);
          address = locationInfo.standardized || address;
          if (!locationInfo.city && prop.city) locationInfo.city = prop.city;
          if (!locationInfo.state && prop.state) locationInfo.state = prop.state;
          if (!locationInfo.zip && prop.zipCode) locationInfo.zip = prop.zipCode;
        }
        
        propertyType = prop.propertyType || propertyType;
        yearBuilt = prop.yearBuilt || yearBuilt;
        stories = prop.features && prop.features.floorCount ? prop.features.floorCount : stories;

        if (prop.squareFootage) livingArea = `${prop.squareFootage} sq ft`;
        if (prop.lotSize) lotSize = `${prop.lotSize} sq ft`;

        const lastSaleAmt = prop.lastSalePrice || 0;
        const assessments = prop.taxAssessments || {};
        const years = Object.keys(assessments).sort((a, b) => b - a);
        const latestAssessment = years.length > 0 ? assessments[years[0]] : null;
        const taxAssessed = latestAssessment ? latestAssessment.value : Math.floor(lastSaleAmt * 0.75);

        propVal = lastSaleAmt || (latestAssessment ? Math.floor(latestAssessment.value / 0.75) : 0);
        if (propVal > 0 && propVal < 10000 && latestAssessment?.value) {
          propVal = Math.floor(latestAssessment.value);
        }
        if (propVal > 0 && propVal < 10000 && lastSaleAmt > propVal) {
          propVal = lastSaleAmt;
        }
        
        const lastSaleRecDate = prop.lastSaleDate ? new Date(prop.lastSaleDate).toLocaleDateString() : 'Not Available';

        let ownerNameResolved = 'Not Available';
        if (prop.owner && prop.owner.names && prop.owner.names.length > 0) {
          ownerNameResolved = prop.owner.names[0];
        }
        
        if (ownerNameResolved !== 'Not Available' && isCorporateOwner(ownerNameResolved)) {
          ownerNameResolved = await resolveCorporateOwner(ownerNameResolved);
        }

        propertyDetails = {
          ownerName: ownerNameResolved,
          ownerOccupied: prop.ownerOccupied === true ? 'Yes' : prop.ownerOccupied === false ? 'No' : 'Not Available',
          mailingAddress: prop.owner && prop.owner.mailingAddress ? prop.owner.mailingAddress.formattedAddress : address,
          propertyValue: propVal ? `$${propVal.toLocaleString('en-US')}` : 'Not Available',
          taxAssessedValue: taxAssessed ? `$${taxAssessed.toLocaleString('en-US')}` : 'Not Available',
          parcelNumber: prop.assessorID || 'Not Available',
          lastSaleDate: lastSaleRecDate,
          lastSalePrice: lastSaleAmt ? `$${lastSaleAmt.toLocaleString('en-US')}` : 'Not Available'
        };
        console.log(`[RentCast Detail API] Loaded details for ${propertyDetails.ownerName}`);
      }
    } catch (err) {
      console.error('[RentCast Detail API] Error:', err);
    }
  }

  let usedMockPropertyFallback = false;
  if (!lat || !lng) {
    const zip = id.split('-')[0] || '90210';
    const offsetIndex = parseInt(id.split('-')[1]) || 1001;
    const idx = offsetIndex % 10;

    address = `${offsetIndex} ${mockAddresses[idx % mockAddresses.length]}, ZIP ${zip}, CA`;
    lat = 34.0736 + (Math.sin(idx) * 0.001);
    lng = -118.4004 + (Math.cos(idx) * 0.001);
    usedMockPropertyFallback = true;

    propertyDetails = {
      ownerName: `[DEV MOCK] ${mockOwners[idx % mockOwners.length]}`,
      ownerOccupied: idx % 4 === 0 ? 'No' : 'Yes',
      mailingAddress: address,
      propertyValue: `$${propVal.toLocaleString('en-US')}`,
      taxAssessedValue: `$${Math.floor(propVal * 0.75).toLocaleString('en-US')}`,
      parcelNumber: `APN-${zip}-${offsetIndex}`,
      lastSaleDate: `08/14/${2010 + idx}`,
      lastSalePrice: `$${Math.floor(propVal * 0.65).toLocaleString('en-US')}`
    };
    console.log(`[Property Enrichment] Using labeled offline-dev mock property for id=${id}`);
  }

  if (!address) {
    address = `Property at ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  let roofTiltDeg = 20;
  let roofAzimuthDeg = 180;
  let googleSolarHit = false;
  let solarBuildingCenter = null;
  let annualSunshineHours = 0;
  let totalRoofAreaSqFt = 0;

  if (isKeyValid(process.env.GOOGLE_SOLAR_API_KEY)) {
    try {
      console.log(`[Google Solar API] Querying coordinates: ${lat}, ${lng}`);
      const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${process.env.GOOGLE_SOLAR_API_KEY}`;
      const response = await trackedFetch('google_solar', solarUrl);
      
      if (response.ok) {
        const solarData = await response.json();
        if (solarData.center?.latitude != null && solarData.center?.longitude != null) {
          solarBuildingCenter = solarData.center;
        }
        if (solarData.solarPotential) {
          const pot = solarData.solarPotential;
          const wholeRoof = pot.wholeRoofStats;
          const buildingStats = pot.buildingStats || {};
          
          const panelWatts = pot.panelCapacityWatts || 400;
          panelCount = pot.maxArrayPanelsCount;
          sizeKw = ((panelCount * panelWatts) / 1000).toFixed(1);
          
          const totalRoofSqFt = Math.round(wholeRoof.areaMeters2 * 10.764);
          const buildingSqFt = Math.round((buildingStats.areaMeters2 || wholeRoof.areaMeters2) * 10.764);
          const usableRoofSqFt = Math.round(totalRoofSqFt * 0.7);
          totalRoofAreaSqFt = totalRoofSqFt;
          annualSunshineHours = Math.round(pot.maxSunshineHoursPerYear || 0);
          
          const imgDate = solarData.imageryDate || {};
          const imgQuality = solarData.imageryQuality || 'MEDIUM';
          const imageryDateStr = imgDate.year ? `${imgDate.month}/${imgDate.day}/${imgDate.year}` : 'N/A';
          
          const segments = pot.roofSegmentStats || [];
          const primarySegment = segments.length > 0 ? segments.reduce((a, b) => b.stats.areaMeters2 > a.stats.areaMeters2 ? b : a, segments[0]) : null;
          const avgPitch = primarySegment ? primarySegment.pitchDegrees.toFixed(1) : '18';
          const azimuth = primarySegment ? primarySegment.azimuthDegrees.toFixed(0) : 'N/A';
          if (primarySegment) {
            roofTiltDeg = Number(primarySegment.pitchDegrees) || 20;
            roofAzimuthDeg = Number(primarySegment.azimuthDegrees) || 180;
          }
          
          let orientationLabel = 'Unknown';
          if (primarySegment) {
            const az = primarySegment.azimuthDegrees;
            if (az >= 337.5 || az < 22.5) orientationLabel = 'North-Facing';
            else if (az >= 22.5 && az < 67.5) orientationLabel = 'Northeast-Facing';
            else if (az >= 67.5 && az < 112.5) orientationLabel = 'East-Facing';
            else if (az >= 112.5 && az < 157.5) orientationLabel = 'Southeast-Facing';
            else if (az >= 157.5 && az < 202.5) orientationLabel = 'South-Facing (Optimal)';
            else if (az >= 202.5 && az < 247.5) orientationLabel = 'Southwest-Facing';
            else if (az >= 247.5 && az < 292.5) orientationLabel = 'West-Facing';
            else orientationLabel = 'Northwest-Facing';
          }
          
          const bestConfig = pot.solarPanelConfigs && pot.solarPanelConfigs.length > 0 
            ? pot.solarPanelConfigs[pot.solarPanelConfigs.length - 1] 
            : null;
          const annualKwh = bestConfig && bestConfig.yearlyEnergyDcKwh 
            ? Math.round(bestConfig.yearlyEnergyDcKwh) 
            : Math.round(pot.maxSunshineHoursPerYear * parseFloat(sizeKw));
          
          savings = Math.round(annualKwh * 0.18 * 25);
          
          const roofToBuildingRatio = wholeRoof.areaMeters2 / (buildingStats.areaMeters2 || wholeRoof.areaMeters2);
          let existingSolarStatus = 'No panels detected';
          if (roofToBuildingRatio > 1.3 && segments.length > 15) {
            existingSolarStatus = 'Possible — Elevated roof structures detected';
          } else if (segments.length > 20) {
            existingSolarStatus = 'Likely — Multiple elevated segments found';
          }
          
          const minSunshine = wholeRoof.sunshineQuantiles[0];
          const maxSunshine = wholeRoof.sunshineQuantiles[10];
          const shadingPct = Math.round((1 - (minSunshine / maxSunshine)) * 100);
          let shadingLabel = `${shadingPct}% variation`;
          if (shadingPct < 20) shadingLabel = `Minimal (${shadingPct}%)`;
          else if (shadingPct < 40) shadingLabel = `Moderate (${shadingPct}%)`;
          else shadingLabel = `Significant (${shadingPct}%)`;
          
          solarDetails = {
            roofOutline: `Identified — ${segments.length} roof segments`,
            totalRoofArea: `${totalRoofSqFt.toLocaleString('en-US')} sq ft`,
            usableRoofArea: `${usableRoofSqFt.toLocaleString('en-US')} sq ft`,
            orientation: `${orientationLabel} (${azimuth}°)`,
            pitch: `${avgPitch}° primary pitch`,
            annualSunlight: `${Math.round(pot.maxSunshineHoursPerYear)} hrs/yr`,
            shading: shadingLabel,
            potential: panelCount > 30 ? 'Excellent' : panelCount > 15 ? 'Good' : 'Moderate',
            recommendedSize: `${sizeKw} kW`,
            estimatedPanels: panelCount,
            annualProduction: `${annualKwh.toLocaleString('en-US')} kWh`,
            twentyFiveYearSavings: `$${savings.toLocaleString('en-US')}`,
            existingSolar: existingSolarStatus,
            imageryDate: imageryDateStr,
            imageryQuality: imgQuality,
            buildingFootprint: `${buildingSqFt.toLocaleString('en-US')} sq ft`,
            panelWattage: `${panelWatts}W each`,
            carbonOffset: `${pot.carbonOffsetFactorKgPerMwh ? Math.round(pot.carbonOffsetFactorKgPerMwh) : 400} kg CO₂/MWh`,
            roofSegments: segments.length
          };
          solarScore = Math.min(99, Math.floor(65 + (panelCount > 40 ? 30 : panelCount * 0.7)));
          googleSolarHit = true;
          
          console.log(`[Google Solar API] Enriched: ${panelCount} panels, ${sizeKw} kW, ${existingSolarStatus}`);
        }
      }
    } catch (err) {
      console.error('[Google Solar API] Error:', err);
    }
  }

  const systemKwNum = parseFloat(sizeKw);
  if (lat && lng && googleSolarHit && systemKwNum > 0) {
    try {
      const nrel = await enrichWithNrel({
        lat,
        lng,
        sizeKw,
        tiltDegrees: roofTiltDeg,
        azimuthDegrees: roofAzimuthDeg,
        solarDetails
      });
      solarDetails = nrel.solarDetails;
      if (nrel.savings != null) savings = nrel.savings;
      if (nrel.annualKwh != null) {
        const cf = parseFloat(String(solarDetails.nrelCapacityFactor || '').replace('%', ''));
        if (!Number.isNaN(cf) && cf > 15) {
          solarScore = Math.min(99, Math.max(solarScore, Math.floor(70 + cf)));
        }
      }
    } catch (err) {
      console.error('[NREL Enrichment] Error:', err.message || err);
    }
  }

  if (!propertyDetails.ownerName || propertyDetails.ownerName === 'Not Available') {
    propertyDetails = {
      ownerName: propertyDetails.ownerName || 'Not Available',
      ownerOccupied: propertyDetails.ownerOccupied || 'Not Available',
      mailingAddress: propertyDetails.mailingAddress || address || 'Not Available',
      propertyValue: propertyDetails.propertyValue || 'Not Available',
      taxAssessedValue: propertyDetails.taxAssessedValue || 'Not Available',
      parcelNumber: propertyDetails.parcelNumber || `APN-${Math.abs(Math.floor(lat * 10000))}`,
      lastSaleDate: propertyDetails.lastSaleDate || 'Not Available',
      lastSalePrice: propertyDetails.lastSalePrice || 'Not Available'
    };
  }

  let contactEnrichment = {
    propertyDetails,
    contactDetails: emptyContactDetails(),
    phoneType: 'Not Available',
    contactSource: 'skipped',
    missingFields: ['phone', 'email'],
    contactComplete: false
  };
  let phoneType = 'Not Available';
  let emailStatus = 'Not Available';

  if (!skipContacts) {
    contactEnrichment = await enrichOwnerContacts({
      address,
      locationInfo,
      propertyDetails
    });
    propertyDetails = contactEnrichment.propertyDetails;
    contactDetails = contactEnrichment.contactDetails;
    phoneType = contactEnrichment.phoneType;

    if (usedMockPropertyFallback && !hasAnyContact(contactDetails)) {
      contactDetails = {
        phone: 'Not Available',
        email: 'Not Available',
        linkedIn: 'Not Available',
        confidenceScore: 'Mock property (offline-dev) — no real contact fabricated'
      };
    }

    if (!isMissingField(contactDetails.email)) {
      emailStatus = await validateEmailWithVerifalia(contactDetails.email);
    }
    if (!isMissingField(contactDetails.phone) && phoneType === 'Not Available') {
      phoneType = await lookupPhoneWithTwilio(contactDetails.phone);
    }
  }

  const contactAvailabilityScore = scoreContactQuality(contactDetails, propertyDetails.ownerName) * 12;
  const leadScore = Math.floor(
    (solarScore * 0.3) +
    ((propertyDetails.ownerOccupied === 'Yes' ? 100 : propertyDetails.ownerOccupied === 'No' ? 50 : 40) * 0.2) +
    ((propVal > 500000 ? 100 : propVal > 0 ? 70 : 40) * 0.2) +
    ((panelCount > 25 ? 100 : panelCount > 0 ? 60 : 35) * 0.2) +
    (Math.min(100, contactAvailabilityScore) * 0.1)
  );

  const sunlightExposureScore = annualSunshineHours > 0
    ? Math.min(100, Math.round((annualSunshineHours / 2200) * 100))
    : (solarScore > 0 ? Math.min(100, solarScore) : 0);
  const roofSizeScore = totalRoofAreaSqFt > 0
    ? Math.min(100, Math.round(totalRoofAreaSqFt / 30))
    : 0;
  const propertyValueScore = propVal > 600000 ? 95 : propVal > 350000 ? 80 : propVal > 0 ? 65 : 0;

  let leadLabel = 'Insufficient Data';
  let leadSummary = 'Live enrichment is incomplete for this property. Try another pin or wait for provider data.';
  if (leadScore >= 85) {
    leadLabel = 'Excellent Candidate';
    leadSummary = 'Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.';
  } else if (leadScore >= 70) {
    leadLabel = 'Strong Candidate';
    leadSummary = 'Good roof and sunlight profile with solid property indicators from live data sources.';
  } else if (leadScore >= 55) {
    leadLabel = 'Moderate Candidate';
    leadSummary = 'Some solar potential exists, but roof, value, or contact signals are mixed.';
  } else if (leadScore > 0) {
    leadLabel = 'Low Priority';
    leadSummary = 'Limited solar potential or incomplete owner/contact data from live providers.';
  }

  const resolvedCoords = await resolvePropertyCoordinates({
    address,
    rentcastProp: rentcastPropUsed,
    providedLat: lat,
    providedLng: lng,
    solarCenter: solarBuildingCenter,
    geocodeIfNeeded: true
  });
  if (resolvedCoords) {
    lat = resolvedCoords.lat;
    lng = resolvedCoords.lng;
  }

  const imageUrl = buildGoogleSatelliteStaticUrl(lat, lng, {
    zoom: '20',
    size: '640x360',
    scale: '2'
  });

  const result = {
    id,
    address,
    lat,
    lng,
    imageUrl,
    propertyType,
    yearBuilt,
    livingArea,
    lotSize,
    stories,
    solarScore,
    _locationInfo: locationInfo,

    solar: solarDetails,
    propertyData: propertyDetails,
    contact: {
      ...contactDetails,
      emailStatus,
      phoneType
    },
    enrichmentMeta: {
      contactSource: contactEnrichment.contactSource,
      contactComplete: contactEnrichment.contactComplete,
      missingFields: contactEnrichment.missingFields,
      usedMockPropertyFallback,
      googleSolarHit,
      skipContacts,
      dataSources: {
        property: propertyDetails.ownerName && propertyDetails.ownerName !== 'Not Available' ? 'RentCast' : (usedMockPropertyFallback ? 'offline-dev' : 'unavailable'),
        solar: googleSolarHit ? 'Google Solar' : 'unavailable',
        production: solarDetails.productionSource || (googleSolarHit ? 'Google Solar' : 'unavailable'),
        contact: skipContacts ? 'deferred' : (contactEnrichment.contactSource || 'unavailable')
      }
    },

    aiLeadScore: {
      overall: leadScore,
      label: leadLabel,
      summary: leadSummary,
      breakdown: {
        solarSuitability: solarScore || 0,
        roofSize: roofSizeScore,
        sunlightExposure: sunlightExposureScore,
        propertyValue: propertyValueScore,
        ownerOccupied: propertyDetails.ownerOccupied === 'Yes' ? 100 : propertyDetails.ownerOccupied === 'No' ? 50 : 0,
        contactAvailability: Math.min(100, Math.max(0, contactAvailabilityScore))
      }
    }
  };

  if (!skipContacts) {
    delete result._locationInfo;
    setCachedEnrichment(id, lat, lng, result);
  }
  return result;
}
