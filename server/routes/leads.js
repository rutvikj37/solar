import express from 'express';
import db from '../db.js';
import { authenticateToken, isAdminRole } from '../middleware/auth.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { checkLeadCreditAccess } from './billing.js';
import { trackedFetch } from '../services/apiUsage.js';
import { cacheRentcastRecords, getCachedRentcastRecord, normalizeAddress } from '../services/rentcastCache.js';
import { getZipFromCoords } from '../services/leadService.js';
import {
  normalizeDetailsCoordinates,
  ensureLeadCoordinates,
  assertAddressMatchesSearch,
  looksLikeStreetAddress,
  parseCoordinatePropertyId,
  buildCoordinatePropertyId,
} from '../services/coordinateService.js';
import {
  getFallbackZipCoords,
  isSingleFamilyType,
  parseMinSavingsThreshold,
  looksPaneledExistingSolar,
  calculateDistance,
  retrievePropertyDetails,
  enrichDetailsWithContacts,
  isPointInPolygon,
  buildGoogleSatelliteStaticUrl,
  fetchGoogleSatelliteImage
} from '../services/propertyService.js';
import { isMissingField, isPlaceholderOwnerName, hasUsableEnrichedContacts } from '../services/contactEnrichmentService.js';
import { getCachedEnrichment } from '../services/enrichmentCache.js';
import { enrollLeadInActiveCampaigns } from '../services/drip/dripEngine.js';
import {
  renderLeadSharePdf,
  leadSharePdfFilename,
  buildLeadShareWhatsAppText,
} from '../utils/leadSharePdf.js';
const router = express.Router();

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

// Generate Lead & Deduct Credits
router.post('/generate', authenticateToken, asyncHandler(async (req, res) => {
  const { propertyId, detail } = req.body;
  if (!propertyId) return res.status(400).json({ error: 'Missing property data' });

  const [roleRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
  const userRole = roleRows[0]?.role || req.user.role;
  const adminBypass = isAdminRole(userRole);

  const [packages] = await db.query('SELECT id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"', [req.user.id]);
  const creditCheck = await checkLeadCreditAccess(req.user.id);
  if (!adminBypass && !creditCheck.allowed) {
    return res.status(402).json({
      error: creditCheck.error,
      credits: creditCheck.credits,
      upgradeRequired: true,
      reason: creditCheck.reason
    });
  }

  const packageRecord = creditCheck.packageRecord || packages[0] || null;

  const parsedCoord = parseCoordinatePropertyId(propertyId);
  const addressHint =
    detail?.expectedAddress ||
    detail?.searchQuery ||
    detail?.address ||
    parsedCoord?.address ||
    null;
  const enrichLat = detail?.lat ?? parsedCoord?.lat;
  const enrichLng = detail?.lng ?? parsedCoord?.lng;

  const cached = getCachedRentcastRecord(propertyId);
  const cachedEnrichment = getCachedEnrichment(propertyId, enrichLat, enrichLng);

  // Accuracy gate: if the user searched a street address, never unlock a different parcel.
  const expectedAddress = addressHint || detail?.expectedAddress || detail?.searchQuery || null;

  let full;
  const cacheMatchesSearch =
    !expectedAddress ||
    !looksLikeStreetAddress(expectedAddress) ||
    assertAddressMatchesSearch(expectedAddress, cachedEnrichment?.address).ok;

  const cacheHasOwner = !isPlaceholderOwnerName(cachedEnrichment?.propertyData?.ownerName);
  const cacheHasContacts =
    !isMissingField(cachedEnrichment?.contact?.phone) ||
    !isMissingField(cachedEnrichment?.contact?.email);
  if (cachedEnrichment && (cacheHasOwner || cacheHasContacts) && cacheMatchesSearch) {
    console.log(`[Lead Generate] Reusing enrichment cache for ${propertyId}`);
    full = cachedEnrichment;
  } else {
    full = await retrievePropertyDetails(
      propertyId,
      enrichLat,
      enrichLng,
      cached,
      {
        skipContacts: false,
        bypassCache: false,
        addressHint,
      },
    );
  }
  if (!full?.address) {
    return res.status(400).json({ error: 'Could not resolve this property' });
  }
  if (expectedAddress && looksLikeStreetAddress(expectedAddress)) {
    const gate = assertAddressMatchesSearch(expectedAddress, full.address);
    if (!gate.ok) {
      console.error(
        `[Lead Generate] Address mismatch blocked: searched "${gate.searched}" resolved "${gate.resolved}"`
      );
      return res.status(409).json({
        error: 'Resolved property does not match the searched address. Please search again.',
        searched: gate.searched,
        resolved: gate.resolved,
        reason: gate.reason,
      });
    }
  }

  const parseValueSafe = (val, regex) => {
    if (!val || val === 'Not Available') return 0;
    const numStr = String(val).replace(regex, '');
    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const [existing] = await db.query('SELECT * FROM leads WHERE user_id = ? AND address = ?', [req.user.id, full.address]);
  if (existing.length > 0) {
    const row = existing[0];
    const sparse =
      isPlaceholderOwnerName(row.owner_name) &&
      isMissingField(row.phone) &&
      isMissingField(row.email);
    const improved =
      !isPlaceholderOwnerName(full.propertyData?.ownerName) ||
      !isMissingField(full.contact?.phone) ||
      !isMissingField(full.contact?.email);

    if (sparse && improved) {
      const propValueNum = parseValueSafe(full.propertyData?.propertyValue, /[$,]/g);
      const livingAreaNum = parseValueSafe(full.livingArea, /[^\d.]/g);
      const roofAreaNum =
        parseValueSafe(full.solar?.totalRoofArea || full.solar?.usableRoofArea, /[^\d.]/g) ||
        livingAreaNum;
      const savingsNum = parseValueSafe(full.solar?.twentyFiveYearSavings, /[$,]/g);
      await db.query(
        `UPDATE leads SET
           owner_name = ?, phone = ?, phone_type = ?, email = ?, email_status = ?,
           linkedin = ?, mailing_address = ?, property_value = ?, owner_occupied = ?,
           parcel_id = ?, roof_size = ?, solar_potential = ?, estimated_savings = ?,
           lead_score = ?, solar_json = ?, property_json = ?, image_url = COALESCE(?, image_url)
         WHERE id = ? AND user_id = ?`,
        [
          full.propertyData?.ownerName,
          full.contact?.phone,
          full.contact?.phoneType || 'Not Available',
          full.contact?.email,
          full.contact?.emailStatus || 'Not Available',
          full.contact?.linkedIn || 'Not Available',
          full.propertyData?.mailingAddress,
          propValueNum,
          full.propertyData?.ownerOccupied === 'Yes' ? 1 : 0,
          full.propertyData?.parcelNumber,
          roofAreaNum,
          full.solar?.potential,
          savingsNum,
          full.aiLeadScore?.overall,
          JSON.stringify(full.solar || {}),
          JSON.stringify({
            ...(full.propertyData || {}),
            livingArea: full.livingArea,
            lotSize: full.lotSize,
            stories: full.stories,
            propertyType: full.propertyType,
            yearBuilt: full.yearBuilt,
            aiLeadScore: full.aiLeadScore || null,
          }),
          full.imageUrl || null,
          row.id,
          req.user.id,
        ],
      );
      console.log(`[Lead Generate] Refreshed sparse saved lead #${row.id}`);
    }

    return res.status(200).json({
      message: 'Lead already generated',
      leadId: row.id,
      detail: { ...full, unlocked: true, leadId: row.id },
      unlocked: true
    });
  }

  const propValueNum = parseValueSafe(full.propertyData?.propertyValue, /[$,]/g);
  const livingAreaNum = parseValueSafe(full.livingArea, /[^\d.]/g);
  const roofAreaNum = parseValueSafe(full.solar?.totalRoofArea || full.solar?.usableRoofArea, /[^\d.]/g) || livingAreaNum;
  const savingsNum = parseValueSafe(full.solar?.twentyFiveYearSavings, /[$,]/g);

  await normalizeDetailsCoordinates(full);

  const [leadResult] = await db.query(
    `INSERT INTO leads (user_id, address, latitude, longitude, owner_name, phone, phone_type, email, email_status, linkedin, mailing_address, property_value, owner_occupied, parcel_id, roof_size, solar_potential, estimated_savings, lead_score, status, solar_json, property_json, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      full.address,
      parseFloat(full.lat) || null,
      parseFloat(full.lng) || null,
      full.propertyData?.ownerName,
      full.contact?.phone,
      full.contact?.phoneType || 'Not Available',
      full.contact?.email,
      full.contact?.emailStatus || 'Not Available',
      full.contact?.linkedIn || 'Not Available',
      full.propertyData?.mailingAddress,
      propValueNum,
      full.propertyData?.ownerOccupied === 'Yes' ? 1 : 0,
      full.propertyData?.parcelNumber,
      roofAreaNum,
      full.solar?.potential,
      savingsNum,
      full.aiLeadScore?.overall,
      'new',
      JSON.stringify(full.solar || {}),
      JSON.stringify({
        ...(full.propertyData || {}),
        latitude: parseFloat(full.lat) || null,
        longitude: parseFloat(full.lng) || null,
        livingArea: full.livingArea,
        lotSize: full.lotSize,
        stories: full.stories,
        propertyType: full.propertyType,
        yearBuilt: full.yearBuilt,
        aiLeadScore: full.aiLeadScore || null
      }),
      full.imageUrl || null
    ]
  );

  if (!adminBypass && packageRecord) {
    await db.query(
      'UPDATE user_packages SET remaining_leads = remaining_leads - 1 WHERE id = ?',
      [packageRecord.id]
    );
  }

  // Auto-enroll lead into active drip campaigns
  await enrollLeadInActiveCampaigns(req.user.id, leadResult.insertId);

  res.status(201).json({
    message: 'Lead generated successfully',
    leadId: leadResult.insertId,
    adminBypass,
    detail: { ...full, unlocked: true, leadId: leadResult.insertId },
    unlocked: true
  });
}));

// Pipeline summary counts
router.get('/pipeline/summary', authenticateToken, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT status, COUNT(*) AS count FROM leads WHERE user_id = ? GROUP BY status',
    [req.user.id]
  );
  const PIPELINE_STATUSES = ['new', 'contacted', 'appointment', 'proposal', 'won', 'lost', 'qualified', 'in_progress'];
  const summary = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s, 0]));
  rows.forEach((r) => {
    summary[r.status] = r.count;
  });
  res.json(summary);
}));

// Get User Leads
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const [leads] = await db.query('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(leads);
}));

// Export User Leads as CSV
router.get('/export-csv', authenticateToken, asyncHandler(async (req, res) => {
  const [leads] = await db.query('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  
  const headers = [
    'Lead ID',
    'Owner Name',
    'Property Address',
    'Lead Score',
    'Phone Number',
    'Email Address',
    'LinkedIn Profile',
    'Status',
    'Created At'
  ];
  
  const rows = leads.map(lead => [
    lead.id,
    lead.owner_name || 'N/A',
    `"${(lead.address || '').replace(/"/g, '""')}"`,
    lead.lead_score || 0,
    lead.phone || 'N/A',
    lead.email || 'N/A',
    lead.linkedin || 'N/A',
    lead.status || 'generated',
    lead.created_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=solar_velocity_leads.csv');
  res.status(200).send(csvContent);
}));

// Bulk Delete Leads
router.post('/bulk-delete', authenticateToken, asyncHandler(async (req, res) => {
  const { leadIds } = req.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds array is required' });
  }
  await db.query('DELETE FROM leads WHERE user_id = ? AND id IN (?)', [req.user.id, leadIds]);
  res.json({ success: true, message: `Successfully deleted ${leadIds.length} leads` });
}));

// Bulk Area Scan
router.post('/bulk-scan', authenticateToken, asyncHandler(async (req, res) => {
  let {
    zip,
    lat,
    lng,
    radius,
    radiusUnit,
    polygon,
    minSqFt,
    intentLevel,
    leadCreditCost,
    homesToScan,
    skipPaneled,
    singleFamily,
    minSavings
  } = req.body;

  if (!zip && lat && lng) {
    console.log(`[Bulk Scan API] No ZIP provided, reverse-geocoding coords: ${lat}, ${lng}`);
    zip = await getZipFromCoords(lat, lng);
    console.log(`[Bulk Scan API] Resolved ZIP: ${zip}`);
  }

  if (!zip) return res.status(400).json({ error: 'ZIP code required or coordinates not resolvable' });

  const requestedQuota = Math.min(
    50,
    Math.max(1, Number(homesToScan) || Number(leadCreditCost) || 15)
  );

  const [roleRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
  const userRole = roleRows[0]?.role || req.user.role;
  const adminBypass = isAdminRole(userRole);

  const [packages] = await db.query('SELECT id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"', [req.user.id]);
  const creditCheck = await checkLeadCreditAccess(req.user.id);
  if (!adminBypass && !creditCheck.allowed) {
    return res.status(402).json({
      error: creditCheck.error,
      credits: creditCheck.credits,
      upgradeRequired: true,
      reason: creditCheck.reason
    });
  }
  if (!adminBypass && creditCheck.credits < requestedQuota) {
    return res.status(402).json({
      error: `Insufficient lead credits. Bulk scan requires at least ${requestedQuota} credits.`,
      credits: creditCheck.credits,
      upgradeRequired: true,
      reason: 'no_credits'
    });
  }

  const packageRecord = creditCheck.packageRecord || packages[0] || null;
  const queryLimit = requestedQuota;
  const minSavingsNum = parseMinSavingsThreshold(minSavings);
  const wantSingleFamily = singleFamily === true || singleFamily === 'true' || singleFamily === 1 || singleFamily === '1';
  const wantSkipPaneled = skipPaneled === true || skipPaneled === 'true' || skipPaneled === 1 || skipPaneled === '1';

  let centerLat = parseFloat(lat);
  let centerLng = parseFloat(lng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || (!centerLat && !centerLng)) {
    centerLat = NaN;
    centerLng = NaN;
    if (isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        const geoRes = await trackedFetch('google_maps', geoUrl);
        const geoData = await geoRes.json();
        if (geoData.results?.[0]?.geometry?.location) {
          centerLat = geoData.results[0].geometry.location.lat;
          centerLng = geoData.results[0].geometry.location.lng;
        }
      } catch (err) {
        console.error('[Bulk Scan API] ZIP geocode failed:', err.message || err);
      }
    }
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      const fallback = getFallbackZipCoords(zip);
      if (fallback) {
        centerLat = fallback.lat;
        centerLng = fallback.lng;
      }
    }
  }

  const unit = String(radiusUnit || 'meters').toLowerCase();
  const radiusRaw = parseFloat(radius);
  let radiusMeters = 0;
  let radiusMiles = 0;
  if (Number.isFinite(radiusRaw) && radiusRaw > 0) {
    if (unit === 'miles' || unit === 'mi') {
      radiusMiles = Math.max(0.1, radiusRaw);
      radiusMeters = radiusMiles * 1609.34;
    } else {
      radiusMeters = radiusRaw;
      radiusMiles = Math.max(0.1, radiusMeters / 1609.34);
    }
  }

  let propertiesList = [];
  let usedMockListing = false;

  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  if (isKeyValid(rentcastApiKey)) {
    const rentcastLimit = Math.min(500, Math.max(80, queryLimit * 5));
    let rentcastSearchUrl = `https://api.rentcast.io/v1/properties?zipCode=${zip}&limit=${rentcastLimit}`;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && radiusMiles > 0) {
      rentcastSearchUrl = `https://api.rentcast.io/v1/properties?latitude=${centerLat}&longitude=${centerLng}&radius=${radiusMiles.toFixed(2)}&limit=${rentcastLimit}`;
    }
    const searchRes = await trackedFetch('rentcast', rentcastSearchUrl, {
      headers: {
        'X-Api-Key': rentcastApiKey,
        'accept': 'application/json'
      }
    });
    if (searchRes.ok) {
      const properties = await searchRes.json();
      if (Array.isArray(properties)) {
        propertiesList = properties;
        cacheRentcastRecords(properties);
      }
    }
  }

  if (Array.isArray(polygon) && polygon.length >= 3) {
    propertiesList = propertiesList.filter((prop) => {
      const propLat = parseFloat(prop.latitude);
      const propLng = parseFloat(prop.longitude);
      if (!propLat || !propLng) return false;
      return isPointInPolygon({ lat: propLat, lng: propLng }, polygon);
    });
  } else if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && radiusMeters > 0) {
    propertiesList = propertiesList.filter((prop) => {
      const propLat = parseFloat(prop.latitude);
      const propLng = parseFloat(prop.longitude);
      if (!propLat || !propLng) return false;
      return calculateDistance(centerLat, centerLng, propLat, propLng) <= radiusMeters;
    });
  }

  if (wantSingleFamily) {
    propertiesList = propertiesList.filter((prop) => {
      const t = prop.propertyType || prop.features?.propertyType || '';
      if (!t) return true;
      return isSingleFamilyType(t);
    });
  }

  propertiesList.sort((a, b) => {
    const aHasOwner = a.owner && Array.isArray(a.owner.names) && a.owner.names.length > 0 ? 1 : 0;
    const bHasOwner = b.owner && Array.isArray(b.owner.names) && b.owner.names.length > 0 ? 1 : 0;
    return bHasOwner - aHasOwner;
  });

  if (propertiesList.length === 0) {
    usedMockListing = true;
    const mockStreets = ['Alta Dr', 'Bedford Dr', 'Marilyn Dr', 'Oakhurst Dr', 'Beverly Dr', 'Crescent Dr', 'Loma Vista Dr', 'Sunset Blvd'];
    for (let i = 1; i <= Math.max(15, queryLimit); i++) {
      propertiesList.push({
        id: `bulk-${zip}-${i}`,
        formattedAddress: `${100 + i * 17} ${mockStreets[i % mockStreets.length]}, BEVERLY HILLS, CA ${zip}`,
        latitude: 34.0736 + (Math.sin(i) * 0.0015),
        longitude: -118.4004 + (Math.cos(i) * 0.0018),
        propertyType: i % 5 === 0 ? 'Condo' : 'Single Family',
        _isMockListing: true
      });
    }
    if (wantSingleFamily) {
      propertiesList = propertiesList.filter((p) => isSingleFamilyType(p.propertyType));
    }
  }

  // Dedupe property list by normalized address so enrichment cannot collapse to one home
  const dedupedProperties = [];
  const seenPropertyAddresses = new Set();
  for (const prop of propertiesList) {
    const addrLine = prop.formattedAddress || (prop.address ? prop.address.oneLine : '');
    const norm = normalizeAddress(addrLine);
    if (norm && seenPropertyAddresses.has(norm)) continue;
    if (norm) seenPropertyAddresses.add(norm);
    dedupedProperties.push(prop);
  }
  propertiesList = dedupedProperties;

  const [existingLeadRows] = await db.query('SELECT address FROM leads WHERE user_id = ?', [req.user.id]);
  const existingNormalizedAddresses = new Set(
    existingLeadRows.map((row) => normalizeAddress(row.address)).filter(Boolean)
  );
  const seenInBatch = new Set();

  const summary = {
    requested: queryLimit,
    propertiesFound: propertiesList.length,
    usedMockListing,
    leadsCount: 0,
    withContact: 0,
    withoutContact: 0,
    skipped: 0,
    skippedReasons: {
      duplicate: 0,
      noAddress: 0,
      minSqFt: 0,
      intentLevel: 0,
      singleFamily: 0,
      skipPaneled: 0,
      minSavings: 0
    },
    phase: 'enriching'
  };

  const deferredPropertyOnly = [];
  const createdLeadIds = [];
  const createdLeadsPreview = [];

  const isDuplicateLeadAddress = (address) => {
    const norm = normalizeAddress(address);
    if (!norm) return false;
    if (seenInBatch.has(norm)) return true;
    if (existingNormalizedAddresses.has(norm)) return true;
    return false;
  };

  const markLeadAddressSaved = (address) => {
    const norm = normalizeAddress(address);
    if (!norm) return;
    seenInBatch.add(norm);
    existingNormalizedAddresses.add(norm);
  };

  const saveLeadFromDetails = async (details, { hasContact, incompleteNote }) => {
    const parseValueSafe = (val, regex) => {
      if (!val || val === 'Not Available') return 0;
      const numStr = String(val).replace(regex, '');
      const parsed = parseFloat(numStr);
      return isNaN(parsed) ? 0 : parsed;
    };

    const propValueNum = parseValueSafe(details.propertyData.propertyValue, /[$,]/g);
    const livingAreaNum = parseValueSafe(details.livingArea, /[^\d.]/g);
    const roofAreaNum = parseValueSafe(details.solar?.totalRoofArea || details.solar?.usableRoofArea, /[^\d.]/g) || livingAreaNum;
    const savingsNum = parseValueSafe(details.solar.twentyFiveYearSavings, /[$,]/g);
    const leadStatus = hasContact ? 'qualified' : 'new';

    await normalizeDetailsCoordinates(details);

    const [insertResult] = await db.query(
      `INSERT INTO leads (
        user_id, address, latitude, longitude, owner_name, lead_score,
        phone, phone_type, email, email_status, linkedin, status,
        property_value, roof_size, estimated_savings, parcel_id,
        owner_occupied, solar_potential, mailing_address, notes,
        solar_json, property_json, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        details.address,
        parseFloat(details.lat) || null,
        parseFloat(details.lng) || null,
        details.propertyData.ownerName,
        details.aiLeadScore.overall,
        details.contact.phone,
        details.contact.phoneType || 'Not Available',
        details.contact.email,
        details.contact.emailStatus || 'Not Available',
        details.contact.linkedIn || 'Not Available',
        leadStatus,
        propValueNum,
        roofAreaNum,
        savingsNum,
        details.propertyData.parcelNumber,
        details.propertyData.ownerOccupied === 'Yes' ? 1 : 0,
        details.solar.potential || 'NOT AVAILABLE',
        details.propertyData.mailingAddress,
        incompleteNote || null,
        JSON.stringify(details.solar || {}),
        JSON.stringify({
          ...(details.propertyData || {}),
          latitude: parseFloat(details.lat) || null,
          longitude: parseFloat(details.lng) || null,
          livingArea: details.livingArea,
          lotSize: details.lotSize,
          stories: details.stories,
          propertyType: details.propertyType,
          yearBuilt: details.yearBuilt,
          aiLeadScore: details.aiLeadScore || null
        }),
        details.imageUrl || null
      ]
    );

    if (insertResult?.insertId) {
      createdLeadIds.push(insertResult.insertId);
      createdLeadsPreview.push({
        id: insertResult.insertId,
        owner_name: details.propertyData.ownerName,
        address: details.address,
        lead_score: details.aiLeadScore.overall,
        created_at: new Date().toISOString(),
      });
      markLeadAddressSaved(details.address);
    }

    summary.leadsCount++;
    if (hasContact) summary.withContact++;
    else summary.withoutContact++;
  };

  for (let propIndex = 0; propIndex < propertiesList.length; propIndex++) {
    const prop = propertiesList[propIndex];
    if (summary.leadsCount >= queryLimit) break;

    const propIdStr = prop.id || (prop.identifier ? (prop.identifier.attomId || prop.identifier.Id) : `bulk-${zip}-${propIndex}`);
    const addressLine = prop.formattedAddress || (prop.address ? prop.address.oneLine : '');
    const latVal = parseFloat(prop.latitude) || (prop.location ? parseFloat(prop.location.latitude) : 0);
    const lngVal = parseFloat(prop.longitude) || (prop.location ? parseFloat(prop.location.longitude) : 0);

    if (!addressLine && !(latVal && lngVal)) {
      summary.skipped++;
      summary.skippedReasons.noAddress++;
      continue;
    }

    const targetId = `rentcast-${propIdStr}__${encodeURIComponent(addressLine || `${latVal},${lngVal}`)}`;

    if (addressLine && isDuplicateLeadAddress(addressLine)) {
      summary.skipped++;
      summary.skippedReasons.duplicate++;
      continue;
    }

    let details = await retrievePropertyDetails(
      targetId,
      latVal,
      lngVal,
      prop._isMockListing ? null : prop,
      { skipContacts: true, bypassCache: true }
    );

    if (!details.address || details.address === 'Not Available') {
      summary.skipped++;
      summary.skippedReasons.noAddress++;
      continue;
    }

    if (isDuplicateLeadAddress(details.address)) {
      summary.skipped++;
      summary.skippedReasons.duplicate++;
      continue;
    }

    if (wantSingleFamily && details.propertyType && !isSingleFamilyType(details.propertyType)) {
      summary.skipped++;
      summary.skippedReasons.singleFamily++;
      continue;
    }

    if (wantSkipPaneled && looksPaneledExistingSolar(details.solar?.existingSolar)) {
      summary.skipped++;
      summary.skippedReasons.skipPaneled++;
      continue;
    }

    const savingsNum = (() => {
      const raw = details.solar?.twentyFiveYearSavings;
      if (!raw || raw === 'Not Available') return 0;
      return parseFloat(String(raw).replace(/[$,]/g, '')) || 0;
    })();
    if (minSavingsNum > 0 && savingsNum < minSavingsNum) {
      summary.skipped++;
      summary.skippedReasons.minSavings++;
      continue;
    }

    if (minSqFt && details.solar && details.solar.usableRoofArea) {
      const usableAreaNum = parseInt(String(details.solar.usableRoofArea).replace(/[^0-9]/g, ''), 10) || 0;
      if (usableAreaNum < minSqFt) {
        summary.skipped++;
        summary.skippedReasons.minSqFt++;
        continue;
      }
    }

    details = await enrichDetailsWithContacts(details);

    if (intentLevel && intentLevel !== 'All') {
      const score = details.aiLeadScore.overall;
      if (intentLevel === 'Qualified' && score <= 70) {
        summary.skipped++;
        summary.skippedReasons.intentLevel++;
        continue;
      }
      if (intentLevel === 'High Intent' && score <= 85) {
        summary.skipped++;
        summary.skippedReasons.intentLevel++;
        continue;
      }
    }

    const hasPhone = !isMissingField(details.contact.phone);
    const hasEmail = !isMissingField(details.contact.email);
    const hasLinkedIn = !isMissingField(details.contact.linkedIn);
    const hasContact = hasPhone || hasEmail || hasLinkedIn;
    const hasName = !isPlaceholderOwnerName(details.propertyData.ownerName);
    const meta = details.enrichmentMeta || {};

    const missingBits = [];
    if (!hasName) missingBits.push('ownerName');
    if (!hasPhone) missingBits.push('phone');
    if (!hasEmail) missingBits.push('email');

    let incompleteNote = null;
    if (!hasContact) {
      incompleteNote = `Incomplete contact after enrichment (source=${meta.contactSource || 'none'}). Missing: ${missingBits.join(', ') || 'phone/email'}. Property + solar data retained.`;
    } else if (missingBits.length > 0) {
      incompleteNote = `Partial contact (source=${meta.contactSource || 'none'}). Missing: ${missingBits.join(', ')}.`;
    }
    if (usedMockListing || meta.usedMockPropertyFallback) {
      const mockTag = 'Offline-dev mock listing — not real verified PII.';
      incompleteNote = incompleteNote ? `${incompleteNote} ${mockTag}` : mockTag;
    }

    if (hasContact) {
      await saveLeadFromDetails(details, { hasContact: true, incompleteNote });
    } else {
      markLeadAddressSaved(details.address);
      deferredPropertyOnly.push({ details, incompleteNote });
    }
  }

  for (const item of deferredPropertyOnly) {
    if (summary.leadsCount >= queryLimit) break;
    await saveLeadFromDetails(item.details, { hasContact: false, incompleteNote: item.incompleteNote });
  }

  const previewById = new Map();
  for (const lead of createdLeadsPreview) {
    previewById.set(lead.id, lead);
  }
  const uniqueLeadsPreview = Array.from(previewById.values());

  if (!adminBypass && packageRecord && summary.leadsCount > 0) {
    await db.query(
      'UPDATE user_packages SET remaining_leads = remaining_leads - ? WHERE id = ?',
      [summary.leadsCount, packageRecord.id]
    );
  }

  const [refreshedPackages] = await db.query('SELECT remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"', [req.user.id]);
  const currentCredits = adminBypass ? 9999 : (refreshedPackages[0]?.remaining_leads ?? 0);

  summary.phase = 'completed';
  res.status(200).json({
    message: `Bulk scan complete. Created ${summary.leadsCount} leads (${summary.withContact} with contact details).`,
    creditsDeducted: adminBypass ? 0 : summary.leadsCount,
    creditsRemaining: currentCredits,
    createdLeadIds: [...new Set(createdLeadIds)],
    leads: uniqueLeadsPreview,
    summary,
    adminBypass
  });
}));

// Refresh lead map coordinates (Google Solar rooftop center preferred)
router.post('/:id/refresh-coordinates', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const coordFix = await ensureLeadCoordinates(lead, { force: true });

  if (coordFix.lat != null && coordFix.lng != null) {
    await db.query(
      'UPDATE leads SET latitude = ?, longitude = ? WHERE id = ?',
      [coordFix.lat, coordFix.lng, id]
    );
  }

  res.json({
    latitude: coordFix.lat,
    longitude: coordFix.lng,
    source: coordFix.source || null,
    locationType: coordFix.locationType || null,
    updated: coordFix.updated !== false
  });
}));

// Branded SpaceToRoof.com lead sheet PDF (share / download)
router.get('/:id/share-pdf', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  const download = req.query.download === '1' || String(req.query.download).toLowerCase() === 'true';
  const buffer = await renderLeadSharePdf(lead);
  const filename = leadSharePdfFilename(lead);
  const waText = buildLeadShareWhatsAppText(lead);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-WhatsApp-Text', encodeURIComponent(waText));
  res.setHeader('X-PDF-Filename', filename);
  res.setHeader('Access-Control-Expose-Headers', 'X-WhatsApp-Text, X-PDF-Filename, Content-Disposition');
  res.send(buffer);
}));

// Get Single Lead details
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const leadRow = await fetchLeadForUser(id, req.user.id, req.user.role);
  if (!leadRow) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  const lead = leadRow;
  let solar = null;
  let propertyExtra = null;
  try {
    solar = lead.solar_json ? JSON.parse(lead.solar_json) : null;
  } catch (_) {
    solar = null;
  }
  try {
    propertyExtra = lead.property_json ? JSON.parse(lead.property_json) : null;
  } catch (_) {
    propertyExtra = null;
  }

  try {
    const coordFix = await ensureLeadCoordinates(lead);
    if (coordFix.updated && coordFix.lat != null && coordFix.lng != null) {
      await db.query(
        'UPDATE leads SET latitude = ?, longitude = ? WHERE id = ?',
        [coordFix.lat, coordFix.lng, id]
      );
      lead.latitude = coordFix.lat;
      lead.longitude = coordFix.lng;
      console.log(`[Lead Detail] Corrected coordinates for lead #${id} (source=${coordFix.source})`);
    }
  } catch (coordErr) {
    console.error(`[Lead Detail] Coordinate backfill failed for #${id}:`, coordErr.message || coordErr);
  }

  const needsSolarBackfill =
    !solar ||
    !solar.recommendedSize ||
    solar.recommendedSize === 'Not Available' ||
    !solar.totalRoofArea ||
    solar.totalRoofArea === 'Not Available';

  const needsPropertyBackfill =
    isPlaceholderOwnerName(lead.owner_name) &&
    isPlaceholderOwnerName(propertyExtra?.ownerName);

  const needsContactBackfill =
    isMissingField(lead.phone) && isMissingField(lead.email);

  const lat = parseFloat(lead.latitude);
  const lng = parseFloat(lead.longitude);

  const needsEnrichmentBackfill =
    (needsSolarBackfill || needsPropertyBackfill || needsContactBackfill) &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat &&
    lng;

  if (needsEnrichmentBackfill) {
    try {
      console.log(
        `[Lead Detail] Backfilling lead #${id} @ ${lat},${lng} ` +
          `(solar=${needsSolarBackfill} property=${needsPropertyBackfill} contact=${needsContactBackfill})`,
      );
      const targetId = buildCoordinatePropertyId(lat, lng, lead.address);
      const details = await retrievePropertyDetails(targetId, lat, lng, null, {
        skipContacts: !needsContactBackfill,
        bypassCache: needsPropertyBackfill || needsContactBackfill,
        addressHint: lead.address,
      });
      delete details._locationInfo;
      if (needsSolarBackfill) {
        solar = details.solar || solar;
      }
      propertyExtra = {
        ...(propertyExtra || {}),
        ...(details.propertyData || {}),
        livingArea: details.livingArea || propertyExtra?.livingArea,
        lotSize: details.lotSize || propertyExtra?.lotSize,
        stories: details.stories || propertyExtra?.stories,
        propertyType: details.propertyType || propertyExtra?.propertyType,
        yearBuilt: details.yearBuilt || propertyExtra?.yearBuilt,
        aiLeadScore: details.aiLeadScore || propertyExtra?.aiLeadScore || null,
      };

      const roofAreaNum = (() => {
        const raw = details.solar?.totalRoofArea || details.solar?.usableRoofArea || '';
        const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
        return Number.isNaN(n) ? Number(lead.roof_size) || 0 : n;
      })();
      const savingsNum = (() => {
        const raw = details.solar?.twentyFiveYearSavings || '';
        const n = parseFloat(String(raw).replace(/[$,]/g, ''));
        return Number.isNaN(n) ? Number(lead.estimated_savings) || 0 : n;
      })();
      let propVal = (() => {
        const raw = details.propertyData?.propertyValue || '';
        const n = parseFloat(String(raw).replace(/[$,]/g, ''));
        return Number.isNaN(n) ? Number(lead.property_value) || 0 : n;
      })();
      if (propVal > 0 && propVal < 10000 && Number(lead.property_value) > propVal) {
        propVal = Number(lead.property_value);
      }

      const ownerName = !isPlaceholderOwnerName(details.propertyData?.ownerName)
        ? details.propertyData.ownerName
        : lead.owner_name;
      const phone = !isMissingField(details.contact?.phone) ? details.contact.phone : lead.phone;
      const email = !isMissingField(details.contact?.email) ? details.contact.email : lead.email;
      const phoneType = details.contact?.phoneType || lead.phone_type || 'Not Available';
      const emailStatus = details.contact?.emailStatus || lead.email_status || 'Not Available';
      const mailingAddress =
        details.propertyData?.mailingAddress || lead.mailing_address || lead.address;
      const ownerOccupied =
        details.propertyData?.ownerOccupied === 'Yes'
          ? 1
          : details.propertyData?.ownerOccupied === 'No'
            ? 0
            : lead.owner_occupied;
      const parcelId = details.propertyData?.parcelNumber || lead.parcel_id;

      await db.query(
        `UPDATE leads SET
           solar_json = ?, property_json = ?, image_url = COALESCE(?, image_url),
           roof_size = ?, solar_potential = ?, estimated_savings = ?,
           owner_name = ?, phone = ?, phone_type = ?, email = ?, email_status = ?,
           mailing_address = ?, owner_occupied = ?, parcel_id = ?,
           property_value = CASE WHEN ? > 10000 OR property_value IS NULL OR property_value < 10000 THEN ? ELSE property_value END
         WHERE id = ? AND user_id = ?`,
        [
          JSON.stringify(solar || {}),
          JSON.stringify(propertyExtra || {}),
          details.imageUrl || null,
          roofAreaNum || lead.roof_size,
          details.solar?.potential || lead.solar_potential,
          savingsNum || lead.estimated_savings,
          ownerName,
          phone,
          phoneType,
          email,
          emailStatus,
          mailingAddress,
          ownerOccupied,
          parcelId,
          propVal,
          propVal,
          id,
          req.user.id,
        ],
      );

      lead.owner_name = ownerName;
      lead.phone = phone;
      lead.phone_type = phoneType;
      lead.email = email;
      lead.email_status = emailStatus;
      lead.mailing_address = mailingAddress;
      lead.owner_occupied = ownerOccupied;
      lead.parcel_id = parcelId;
      lead.roof_size = roofAreaNum || lead.roof_size;
      lead.solar_potential = details.solar?.potential || lead.solar_potential;
      lead.estimated_savings = savingsNum || lead.estimated_savings;
      if (propVal > 10000 || Number(lead.property_value) < 10000) {
        lead.property_value = propVal;
      }
      lead.image_url = details.imageUrl || lead.image_url;

      if (details.lat != null && details.lng != null) {
        const detailLat = parseFloat(details.lat);
        const detailLng = parseFloat(details.lng);
        if (!Number.isNaN(detailLat) && !Number.isNaN(detailLng)) {
          await db.query(
            'UPDATE leads SET latitude = ?, longitude = ? WHERE id = ?',
            [detailLat, detailLng, id],
          );
          lead.latitude = detailLat;
          lead.longitude = detailLng;
          console.log(`[Lead Detail] Coordinates synced from enrichment for lead #${id}`);
        }
      }
    } catch (enrichErr) {
      console.error(`[Lead Detail] Enrichment backfill failed for #${id}:`, enrichErr.message || enrichErr);
    }
  }

  // Always rebuild Static Maps URL from current coords + key (stale DB image_url often breaks)
  const imageUrl =
    buildGoogleSatelliteStaticUrl(lat, lng, {
      zoom: '20',
      size: '800x400',
      scale: '2',
      marker: true
    }) || lead.image_url || null;

  const { solar_json, property_json, ...leadRest } = lead;
  res.json({
    ...leadRest,
    solar,
    propertyExtra,
    imageUrl
  });
}));

// Satellite rooftop image proxy — same-origin bytes for proposal PDF/print (avoids Static Maps referrer/key failures in <img>)
router.get('/:id/satellite-image', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lead = await fetchLeadForUser(
    id,
    req.user.id,
    req.user.role,
    'l.id, l.latitude, l.longitude'
  );
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const lat = parseFloat(lead.latitude);
  const lng = parseFloat(lead.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) {
    return res.status(404).json({ error: 'No coordinates for satellite imagery' });
  }
  if (!isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    return res.status(503).json({ error: 'Google Maps API key not configured' });
  }

  const imageOpts = { zoom: '20', size: '800x400', scale: '2', marker: true };
  const fallbackUrl = buildGoogleSatelliteStaticUrl(lat, lng, imageOpts);

  const image = await fetchGoogleSatelliteImage(lat, lng, imageOpts);
  if (image.error) {
    const message = image.error === 'missing_key_or_coords'
      ? 'Google Maps API key not configured'
      : 'Satellite imagery temporarily unavailable';
    return res.status(503).json({
      error: message,
      reason: image.error,
      fallbackUrl: fallbackUrl || undefined
    });
  }

  res.setHeader('Content-Type', image.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(image.buffer);
}));

// Get activities for a lead
router.get('/:id/activities', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lead = await fetchLeadForUser(id, req.user.id, req.user.role, 'l.id');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const [activities] = await db.query(
    'SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 100',
    [id]
  );
  res.json(activities);
}));

// Create activity for a lead
router.post('/:id/activities', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type = 'note', content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const lead = await fetchLeadForUser(id, req.user.id, req.user.role, 'l.id');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  await db.query(
    'INSERT INTO lead_activities (lead_id, user_id, type, content, meta) VALUES (?, ?, ?, ?, NULL)',
    [id, req.user.id, type, content]
  );
  if (type === 'note') {
    await db.query('UPDATE leads SET notes = ? WHERE id = ? AND user_id = ?', [content, id, req.user.id]);
  }

  const [activities] = await db.query(
    'SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 50',
    [id]
  );
  res.status(201).json({ activities });
}));

// Update Lead status
router.patch('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, followUpAt, nextAction, conversationNotes } = req.body;

  const lead = await fetchLeadForUser(id, req.user.id, req.user.role, 'l.id, l.user_id');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const updates = [];
  const params = [];
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }
  if (followUpAt !== undefined) {
    updates.push('follow_up_at = ?');
    params.push(followUpAt ? new Date(followUpAt) : null);
  }
  if (nextAction !== undefined) {
    updates.push('next_action = ?');
    params.push(nextAction || null);
  }
  if (conversationNotes !== undefined) {
    updates.push('conversation_notes = ?');
    params.push(conversationNotes || null);
  }

  if (updates.length > 0) {
    params.push(id, lead.user_id);
    await db.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
  }

  const [updated] = await db.query('SELECT * FROM leads WHERE id = ? AND user_id = ?', [id, lead.user_id]);
  res.json(updated[0]);
}));

export default router;
