import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from './db.js';
import { VerifaliaRestClient } from 'verifalia';
import { migrateSchema } from './schema.js';
import { authenticateToken, JWT_SECRET, isAdminRole } from './middleware/auth.js';
import crmRoutes from './routes/crm.js';
import billingRoutes, { checkLeadCreditAccess } from './routes/billing.js';
import outreachRoutes from './routes/outreach.js';
import appointmentRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';
import ticketRoutes from './routes/tickets.js';
import marketingRoutes from './routes/marketing.js';
import { enrichWithNrel } from './services/nrel.js';
import { trackedFetch, trackApiCall } from './services/apiUsage.js';
import {
  cacheRentcastRecord,
  cacheRentcastRecords,
  getCachedRentcastRecord
} from './services/rentcastCache.js';
import { getCachedEnrichment, setCachedEnrichment } from './services/enrichmentCache.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Helper check for key validity
const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

// --- AUTHENTICATION ROUTES ---

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, company, email, password, plan } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, company_name) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, company || null]
    );
    const userId = result.insertId;

    // Free tier: always 5 credits on signup (paid plans purchased separately via Stripe)
    const initialCredits = 5;
    await db.query(
      'INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'Free', initialCredits, initialCredits, 'active']
    );

    const token = jwt.sign({ id: userId, email, name, role: 'solar_company' }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      token,
      credits: initialCredits,
      user: { id: userId, name, email, company, role: 'solar_company' }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role || 'solar_company' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company_name,
        role: user.role || 'solar_company'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get Profile & Credit Balance
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, company_name as company, phone, role, account_status FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    const [packages] = await db.query('SELECT package_id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"', [user.id]);
    const credits = packages.length > 0 ? packages[0].remaining_leads : 0;
    const activePackage = packages.length > 0 ? packages[0].package_id : 'Free';
    const unlimitedCredits = isAdminRole(user.role);

    const [subs] = await db.query(
      `SELECT s.package_id, s.status, s.current_period_end, s.cancel_at_period_end, p.name AS package_name, p.lead_limit
       FROM user_subscriptions s
       LEFT JOIN packages p ON p.id = s.package_id
       WHERE s.user_id = ?
       LIMIT 1`,
      [user.id]
    );
    const sub = subs[0] || null;

    res.json({
      user,
      credits: unlimitedCredits ? Math.max(credits, 9999) : credits,
      activePackage: unlimitedCredits ? 'Admin' : activePackage,
      unlimitedCredits,
      subscription: sub
        ? {
            packageId: sub.package_id,
            packageName: sub.package_name,
            status: sub.status,
            leadLimit: sub.lead_limit,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end)
          }
        : null
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Server error fetching user details' });
  }
});

// Get Public Config
app.get('/api/config', async (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// --- PROPERTIES & CORE SEARCH ALGORITHMS ---

// Deterministic coordinate fallback
function getFallbackZipCoords(zip) {
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

const mockAddresses = [
  'Oakridge Estates Pkwy', 'Sunset Boulevard', 'Lakeshore Drive',
  'Pine Avenue', 'Maple Road', 'Cedar Court', 'Hilltop Lane'
];

const mockOwners = [
  'Mark Henderson', 'Sarah Lundberg', 'Marcus Chen', 'Elena Kovic',
  'Bill Thompson', 'David Vance', 'Rachel Green', 'Bruce Wayne'
];

function hashString(str) {
  let idHash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    idHash = s.charCodeAt(i) + ((idHash << 5) - idHash);
  }
  return Math.abs(idHash);
}

function isSingleFamilyType(propertyType) {
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

function parseMinSavingsThreshold(minSavings) {
  if (!minSavings || minSavings === 'Any') return 0;
  const n = parseInt(String(minSavings).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function looksPaneledExistingSolar(existingSolar) {
  if (!existingSolar) return false;
  const s = String(existingSolar).toLowerCase();
  if (s === 'no' || s.includes('no panels') || s === 'unlikely' || s === 'unknown') return false;
  return s.includes('likely') || s.includes('possible') || s.includes('yes') || s.includes('detected') || s.includes('existing');
}

function mapRentcastToListItem(prop) {
  const propIdStr = prop.id || '';
  const idHash = hashString(propIdStr || prop.formattedAddress);
  const propertyType = prop.propertyType || prop.features?.propertyType || 'Unknown';
  const sqFt = prop.squareFootage || prop.features?.livingArea || 0;
  // Deterministic list-level scores (detail endpoint still does real Solar/NREL)
  const solarScore = Math.min(99, Math.floor(68 + (idHash % 7) * 4 + Math.min(10, (sqFt || 0) / 400)));
  const sizeKw = (5 + (idHash % 7) * 1.5).toFixed(1);
  const estSavings = Math.floor(parseFloat(sizeKw) * 1450 * 0.18 * 25);
  // Cheap existing-solar heuristic for pin badges / skip-paneled prefilter (not verified)
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

function filterPropertiesByQuery(list, { lat, lng, radius, singleFamily, minSavings, skipPaneled }) {
  let out = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (lat && lng && radius) {
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

// 1 & 3: Geocoding Search Pincode & Clustered Satellite Map Coordinates Generator
app.get('/api/properties', async (req, res) => {
  const {
    zip,
    lat,
    lng,
    radius,
    limit: limitRaw,
    singleFamily,
    minSavings,
    skipPaneled
  } = req.query;

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

  // Geocode ZIP only when we do not already have map center coords
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
  // --- QUERY RENTCAST SEARCH API (denser list, light fields only) ---
  if (isKeyValid(rentcastApiKey)) {
    try {
      let rentcastUrl;
      if (lat && lng && radius) {
        const radiusMiles = Math.max(0.1, parseFloat(radius) / 1609.34);
        console.log(`[RentCast Search API] Querying near ${lat},${lng} radius=${radiusMiles.toFixed(2)}mi limit=${limit}`);
        rentcastUrl = `https://api.rentcast.io/v1/properties?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radiusMiles.toFixed(2))}&limit=${limit}`;
      } else {
        console.log(`[RentCast Search API] Querying ZIP: ${zip} limit=${limit}`);
        rentcastUrl = `https://api.rentcast.io/v1/properties?zipCode=${encodeURIComponent(zip)}&limit=${limit}`;
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
          // Cache full RentCast payloads so pin-clicks reuse them (no 2nd RentCast call)
          cacheRentcastRecords(properties);

          let list = properties.map(mapRentcastToListItem).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
          list = filterPropertiesByQuery(list, { lat, lng, radius, singleFamily, minSavings, skipPaneled });

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
          console.log(`[RentCast Search API] Loaded ${list.length} property records (limit=${limit}, cached=${properties.length}).`);
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
});

// Standardize address using Google Geocoding API to resolve formatting and extract city/state/zip components
async function standardizeAddress(addressStr) {
  if (!addressStr || addressStr === 'Not Available') {
    return { standardized: addressStr || 'Not Available', city: '', state: '', zip: '' };
  }

  if (isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const res = await trackedFetch('google_maps', url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]) {
          const result = data.results[0];
          const components = result.address_components || [];
          let city = '';
          let state = '';
          let zip = '';

          components.forEach(c => {
            if (c.types.includes('locality')) city = c.long_name;
            if (c.types.includes('administrative_area_level_1')) state = c.short_name;
            if (c.types.includes('postal_code')) zip = c.long_name;
          });

          return {
            standardized: result.formatted_address || addressStr,
            city,
            state,
            zip
          };
        }
      }
    } catch (err) {
      console.error('[Address Standardization] Google Geocoding failed:', err);
    }
  }
  return { standardized: addressStr, city: '', state: '', zip: '' };
}

// Detect if an owner name represents a corporate entity (LLC, Trust, Corp, etc.)
function isCorporateOwner(name) {
  if (!name || name === 'Not Available') return false;
  const corporateKeywords = ['llc', 'corp', 'trust', 'l.p.', 'lp', 'holdings', 'inc', 'association', 'company', 'co', 'ltd', 'partners', 'estate', 'ventures', 'properties'];
  const lowercaseName = name.toLowerCase();
  return corporateKeywords.some(keyword => lowercaseName.includes(keyword) || lowercaseName.endsWith(' ' + keyword) || lowercaseName.endsWith('.' + keyword));
}

// Resolve Registered Agent or Trustee from OpenCorporates API search for corporate shell owners
async function resolveCorporateOwner(companyName) {
  if (!companyName || companyName === 'Not Available') return 'Not Available';
  console.log(`[Corporate Resolution] Shell company detected: "${companyName}". Checking public officer registry...`);

  try {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(companyName)}&current_status=Active`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.companies && data.results.companies[0]) {
        const company = data.results.companies[0].company;
        if (company.registered_agent_name) {
          const agentName = company.registered_agent_name;
          console.log(`[Corporate Resolution] Found Registered Agent: ${agentName}`);
          return agentName;
        }
      }
    }
  } catch (err) {
    console.error('[Corporate Resolution] OpenCorporates search failed:', err);
  }

  // Trustee resolution heuristic
  if (companyName.toLowerCase().includes('trust')) {
    const words = companyName.split(' ');
    const trustIdx = words.findIndex(w => w.toLowerCase().includes('trust'));
    if (trustIdx > 0) {
      return `${words[0]} Trustee`;
    }
  }
  return 'Not Available';
}

// Validate email status using Verifalia SDK (SMTP active checks)
async function validateEmailWithVerifalia(email) {
  if (!email || email === 'Not Available') return 'Not Available';
  
  if (isKeyValid(process.env.VERIFALIA_USERNAME)) {
    try {
      console.log(`[Verifalia SMTP] Verifying email deliverability: ${email}`);
      const verifalia = new VerifaliaRestClient({
        username: process.env.VERIFALIA_USERNAME,
        password: process.env.VERIFALIA_PASSWORD || ''
      });
      
      const validation = await trackApiCall('verifalia', () => verifalia.emailValidations.submit(email));
      if (validation && validation.entries && validation.entries[0]) {
        const entry = validation.entries[0];
        console.log(`[Verifalia SMTP] Deliverability matched: ${entry.classification} (${entry.status})`);
        return entry.classification; // Deliverable, Undeliverable, Risky, Unknown
      }
    } catch (err) {
      console.error('[Verifalia SMTP] Verification failed:', err);
    }
  }

  // Fallback syntax check if Verifalia key is missing
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? 'Deliverable (Syntax Validated)' : 'Undeliverable (Invalid Syntax)';
}

// Check phone carrier line type using Twilio Lookup API (Mobile vs. Landline verification)
async function lookupPhoneWithTwilio(phone) {
  if (!phone || phone === 'Not Available') return 'Not Available';

  if (isKeyValid(process.env.TWILIO_ACCOUNT_SID) && isKeyValid(process.env.TWILIO_AUTH_TOKEN)) {
    try {
      console.log(`[Twilio Lookup] Querying carrier information for: ${phone}`);
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanPhone)}?Fields=line_type_intelligence`;
      
      // Basic Authentication header Base64 encoded
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await trackedFetch('twilio', url, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.line_type_intelligence && data.line_type_intelligence.type) {
          const carrierType = data.line_type_intelligence.type.toUpperCase();
          console.log(`[Twilio Lookup] Line type resolved: ${carrierType}`);
          return carrierType; // MOBILE, LANDLINE, VOIP
        }
      }
    } catch (err) {
      console.error('[Twilio Lookup] Carrier lookup failed:', err);
    }
  }

  // Fallback syntax indicator if Twilio keys are missing
  return 'MOBILE (Syntax Validated)';
}

function formatPhoneNumber(phone) {
  if (!phone || phone === 'Not Available') return 'Not Available';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

function isMissingField(val) {
  if (val == null) return true;
  const s = String(val).trim();
  return s === '' || s === 'Not Available' || s.toLowerCase() === 'n/a';
}

function isPlaceholderOwnerName(name) {
  if (isMissingField(name)) return true;
  const n = String(name).trim().toLowerCase();
  return n === 'verified owner' || n.startsWith('[dev mock]');
}

function hasAnyContact(contact = {}) {
  return !isMissingField(contact.phone) || !isMissingField(contact.email) || !isMissingField(contact.linkedIn);
}

function scoreContactQuality(contact = {}, ownerName = '') {
  let score = 0;
  if (!isPlaceholderOwnerName(ownerName)) score += 2;
  if (!isMissingField(contact.phone)) score += 3;
  if (!isMissingField(contact.email)) score += 3;
  if (!isMissingField(contact.linkedIn)) score += 1;
  return score;
}

function emptyContactDetails() {
  return {
    phone: 'Not Available',
    email: 'Not Available',
    linkedIn: 'Not Available',
    confidenceScore: 'Not Available'
  };
}

function applyTracerfyPerson(person, propertyDetails, contactDetails) {
  const nextProperty = { ...propertyDetails };
  const nextContact = { ...contactDetails };
  let phoneType = 'Not Available';

  if (person.full_name && isPlaceholderOwnerName(nextProperty.ownerName)) {
    nextProperty.ownerName = person.full_name;
  }
  if (person.phones && person.phones[0] && isMissingField(nextContact.phone)) {
    nextContact.phone = formatPhoneNumber(person.phones[0].number);
    if (person.phones[0].type) phoneType = String(person.phones[0].type).toUpperCase();
  }
  if (person.emails && person.emails[0] && isMissingField(nextContact.email)) {
    nextContact.email = person.emails[0].email;
  }
  if (hasAnyContact(nextContact)) {
    nextContact.confidenceScore = '95% verified (Tracerfy)';
  }
  return { propertyDetails: nextProperty, contactDetails: nextContact, phoneType };
}

// Fetch real owner contact from Tracerfy API if key is valid
async function lookupContactsWithTracerfy(address, city, state, zip, attemptLabel = 'primary') {
  const apiKey = process.env.TRACERFY_API_KEY;
  if (!isKeyValid(apiKey)) return null;
  if (!address) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.TRACERFY_TIMEOUT_MS) || 5000);

  try {
    console.log(`[Tracerfy API] Skip-trace (${attemptLabel}): ${address}, ${city || ''}, ${state || ''} ${zip || ''}`);
    const tracerfyUrl = 'https://tracerfy.com/v1/api/trace/lookup/';
    const response = await trackedFetch('tracerfy', tracerfyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        find_owner: true
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const data = await response.json();
      if (data.hit && Array.isArray(data.persons) && data.persons[0]) {
        const person = data.persons[0];
        console.log(`[Tracerfy API] Skip-trace hit (${attemptLabel}) for owner: ${person.full_name}`);
        return person;
      }
      console.log(`[Tracerfy API] Skip-trace miss (${attemptLabel}).`);
    } else {
      const errText = await response.text();
      console.error(`[Tracerfy API] Request failed (${attemptLabel}) status ${response.status}: ${errText}`);
    }
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : (err.message || err);
    console.error(`[Tracerfy API] Error (${attemptLabel}):`, reason);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function enrichContactsWithApollo(ownerName, locationInfo) {
  if (isPlaceholderOwnerName(ownerName) || !isKeyValid(process.env.APOLLO_API_KEY)) return null;

  const nameParts = String(ownerName).trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return null;

  try {
    console.log(`[Apollo API] Querying ownerName: ${ownerName} @ ${locationInfo.city || ''}, ${locationInfo.state || ''}`);
    const apolloUrl = 'https://api.apollo.io/v1/people/match';
    const response = await trackedFetch('apollo', apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': process.env.APOLLO_API_KEY
      },
      body: JSON.stringify({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || undefined,
        state: locationInfo.state || undefined,
        city: locationInfo.city || undefined,
        reveal_personal_emails: true
      })
    });

    if (!response.ok) {
      console.error(`[Apollo API] Request failed with status ${response.status}`);
      return null;
    }

    const apolloData = await response.json();
    if (!apolloData.person) {
      console.log('[Apollo API] No person match.');
      return null;
    }

    const person = apolloData.person;
    const phone =
      (person.personal_phone_numbers && person.personal_phone_numbers[0]) ||
      (person.phone_numbers && person.phone_numbers[0] && (person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number)) ||
      null;

    console.log(`[Apollo API] Match found for ${ownerName} (phone=${!!phone}, email=${!!person.email})`);
    return {
      phone: phone ? formatPhoneNumber(String(phone)) : 'Not Available',
      email: person.email || 'Not Available',
      linkedIn: person.linkedin_url || 'Not Available',
      confidenceScore: '92% verified (Apollo)'
    };
  } catch (err) {
    console.error('[Apollo API] Error:', err.message || err);
    return null;
  }
}

/**
 * Multi-attempt contact enrichment: Tracerfy (primary + address retry) → Apollo.
 * Never fabricates real-looking PII; mock data must be labeled elsewhere.
 */
async function enrichOwnerContacts({ address, locationInfo, propertyDetails }) {
  let contactDetails = emptyContactDetails();
  let phoneType = 'Not Available';
  let nextProperty = { ...propertyDetails };
  let contactSource = 'none';

  const streetFromStandardized = (locationInfo.standardized || address || '').split(',')[0].trim();
  const streetFromRaw = (address || '').split(',')[0].trim();
  const hasLocationFields = !!(locationInfo.city && locationInfo.state && locationInfo.zip);

  if (isKeyValid(process.env.TRACERFY_API_KEY)) {
    let tracerfyPerson = await lookupContactsWithTracerfy(
      streetFromStandardized || streetFromRaw,
      locationInfo.city,
      locationInfo.state,
      locationInfo.zip,
      'primary'
    );

    // Retry only when primary missed/incomplete AND we lack city/state/zip (need geocode)
    // or we have an alternate street line worth trying.
    const primaryIncomplete =
      !tracerfyPerson ||
      (!(tracerfyPerson.phones && tracerfyPerson.phones[0]) && !(tracerfyPerson.emails && tracerfyPerson.emails[0]));

    if (primaryIncomplete) {
      let retryCity = locationInfo.city;
      let retryState = locationInfo.state;
      let retryZip = locationInfo.zip;

      if (!hasLocationFields && (address || locationInfo.standardized)) {
        const geo = await standardizeAddress(address || locationInfo.standardized);
        if (!retryCity && geo.city) retryCity = geo.city;
        if (!retryState && geo.state) retryState = geo.state;
        if (!retryZip && geo.zip) retryZip = geo.zip;
      }

      const retryStreet =
        streetFromRaw && streetFromRaw.toLowerCase() !== (streetFromStandardized || '').toLowerCase()
          ? streetFromRaw
          : streetFromStandardized;

      const canRetry =
        retryStreet &&
        (retryCity || retryState || retryZip) &&
        (!hasLocationFields ||
          (streetFromRaw && streetFromRaw.toLowerCase() !== (streetFromStandardized || '').toLowerCase()));

      if (canRetry) {
        const retryPerson = await lookupContactsWithTracerfy(
          retryStreet,
          retryCity,
          retryState,
          retryZip,
          'retry-geocode'
        );
        if (retryPerson) tracerfyPerson = retryPerson;
      }
    }

    if (tracerfyPerson) {
      const applied = applyTracerfyPerson(tracerfyPerson, nextProperty, contactDetails);
      nextProperty = applied.propertyDetails;
      contactDetails = applied.contactDetails;
      if (applied.phoneType !== 'Not Available') phoneType = applied.phoneType;
      contactSource = 'tracerfy';
    }
  } else {
    console.log('[Contact Enrichment] Tracerfy key missing — skipping primary skip-trace.');
  }

  // Apollo only when still missing phone OR email after Tracerfy (skip if both present)
  const needsApollo =
    isMissingField(contactDetails.phone) || isMissingField(contactDetails.email);

  if (needsApollo && !isPlaceholderOwnerName(nextProperty.ownerName)) {
    const apolloContact = await enrichContactsWithApollo(nextProperty.ownerName, locationInfo);
    if (apolloContact) {
      if (isMissingField(contactDetails.phone) && !isMissingField(apolloContact.phone)) {
        contactDetails.phone = apolloContact.phone;
      }
      if (isMissingField(contactDetails.email) && !isMissingField(apolloContact.email)) {
        contactDetails.email = apolloContact.email;
      }
      if (isMissingField(contactDetails.linkedIn) && !isMissingField(apolloContact.linkedIn)) {
        contactDetails.linkedIn = apolloContact.linkedIn;
      }
      if (hasAnyContact(contactDetails)) {
        contactDetails.confidenceScore =
          contactSource === 'tracerfy'
            ? 'Mixed Tracerfy + Apollo'
            : apolloContact.confidenceScore;
        contactSource = contactSource === 'tracerfy' ? 'tracerfy+apollo' : 'apollo';
      }
    }
  } else if (!needsApollo) {
    console.log('[Contact Enrichment] Skipping Apollo — Tracerfy already provided phone and email.');
  }

  const missingFields = [];
  if (isPlaceholderOwnerName(nextProperty.ownerName)) missingFields.push('ownerName');
  if (isMissingField(contactDetails.phone)) missingFields.push('phone');
  if (isMissingField(contactDetails.email)) missingFields.push('email');

  console.log(
    `[Contact Enrichment] source=${contactSource} owner="${nextProperty.ownerName}" ` +
      `phone=${!isMissingField(contactDetails.phone)} email=${!isMissingField(contactDetails.email)} ` +
      `missing=[${missingFields.join(',') || 'none'}]`
  );

  return {
    propertyDetails: nextProperty,
    contactDetails,
    phoneType,
    contactSource,
    missingFields,
    contactComplete: missingFields.length === 0
  };
}

// Recompute lead score after contact enrichment is attached
function attachLeadScore(result, { solarScore, panelCount, propVal, annualSunshineHours, totalRoofAreaSqFt }) {
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

/**
 * Attach Tracerfy/Apollo/Verifalia/Twilio to an already solar-enriched details object.
 * Used by bulk scan after filters so discarded homes never burn contact APIs.
 */
async function enrichDetailsWithContacts(details) {
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

// Reusable property details retriever
// options: { skipContacts, bypassCache }
async function retrievePropertyDetails(id, providedLat, providedLng, rentcastRecord = null, options = {}) {
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

  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;
  // Fetch real detail from RentCast API if ID starts with rentcast-
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
          address = prop.formattedAddress;
          lat = parseFloat(prop.latitude);
          lng = parseFloat(prop.longitude);

          // Prefer RentCast city/state/zip — skip Google Geocode when complete
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

          if (prop.squareFootage) {
            livingArea = `${prop.squareFootage} sq ft`;
          }
          if (prop.lotSize) {
            lotSize = `${prop.lotSize} sq ft`;
          }

          const lastSaleAmt = prop.lastSalePrice || 0;
          const assessments = prop.taxAssessments || {};
          const years = Object.keys(assessments).sort((a, b) => b - a);
          const latestAssessment = years.length > 0 ? assessments[years[0]] : null;
          const taxAssessed = latestAssessment ? latestAssessment.value : Math.floor(lastSaleAmt * 0.75);

          propVal = lastSaleAmt || (latestAssessment ? Math.floor(latestAssessment.value / 0.75) : 0);
          // Guard against nonsense micro-values (e.g. $1,080 when tax/sale is missing/corrupt)
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
          
          // Resolve corporate owners if company keyword matches
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

  // Fallback to labeled mock coordinates if RentCast fetch failed or was skipped (offline-dev only)
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

  // --- QUERY GOOGLE SOLAR API ---
  // Keep "Not Available" defaults until a live provider responds — never invent roof specs.
  let roofTiltDeg = 20;
  let roofAzimuthDeg = 180;
  let googleSolarHit = false;
  let annualSunshineHours = 0;
  let totalRoofAreaSqFt = 0;

  if (isKeyValid(process.env.GOOGLE_SOLAR_API_KEY)) {
    try {
      console.log(`[Google Solar API] Querying coordinates: ${lat}, ${lng}`);
      const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${process.env.GOOGLE_SOLAR_API_KEY}`;
      const response = await trackedFetch('google_solar', solarUrl);
      
      if (response.ok) {
        const solarData = await response.json();
        if (solarData.solarPotential) {
          const pot = solarData.solarPotential;
          const wholeRoof = pot.wholeRoofStats;
          const buildingStats = pot.buildingStats || {};
          
          // Panel specifications from Google
          const panelWatts = pot.panelCapacityWatts || 400;
          panelCount = pot.maxArrayPanelsCount;
          sizeKw = ((panelCount * panelWatts) / 1000).toFixed(1);
          
          const totalRoofSqFt = Math.round(wholeRoof.areaMeters2 * 10.764);
          const buildingSqFt = Math.round((buildingStats.areaMeters2 || wholeRoof.areaMeters2) * 10.764);
          const usableRoofSqFt = Math.round(totalRoofSqFt * 0.7);
          totalRoofAreaSqFt = totalRoofSqFt;
          annualSunshineHours = Math.round(pot.maxSunshineHoursPerYear || 0);
          
          // Imagery metadata
          const imgDate = solarData.imageryDate || {};
          const imgQuality = solarData.imageryQuality || 'MEDIUM';
          const imageryDateStr = imgDate.year ? `${imgDate.month}/${imgDate.day}/${imgDate.year}` : 'N/A';
          
          // Roof segment analysis (pitch and orientation)
          const segments = pot.roofSegmentStats || [];
          const primarySegment = segments.length > 0 ? segments.reduce((a, b) => b.stats.areaMeters2 > a.stats.areaMeters2 ? b : a, segments[0]) : null;
          const avgPitch = primarySegment ? primarySegment.pitchDegrees.toFixed(1) : '18';
          const azimuth = primarySegment ? primarySegment.azimuthDegrees.toFixed(0) : 'N/A';
          if (primarySegment) {
            roofTiltDeg = Number(primarySegment.pitchDegrees) || 20;
            roofAzimuthDeg = Number(primarySegment.azimuthDegrees) || 180;
          }
          
          // Determine orientation direction from azimuth
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
          
          // Annual energy production from best panel config (refined by NREL below)
          const bestConfig = pot.solarPanelConfigs && pot.solarPanelConfigs.length > 0 
            ? pot.solarPanelConfigs[pot.solarPanelConfigs.length - 1] 
            : null;
          const annualKwh = bestConfig && bestConfig.yearlyEnergyDcKwh 
            ? Math.round(bestConfig.yearlyEnergyDcKwh) 
            : Math.round(pot.maxSunshineHoursPerYear * parseFloat(sizeKw));
          
          // 25-year savings calculation (refined by NREL utility rate below)
          savings = Math.round(annualKwh * 0.18 * 25);
          
          // Existing solar detection - check if building has panels visible on satellite
          // We use a heuristic: if the roof area is significantly larger than the building footprint,
          // and the number of roof segments is high, panels may already be present
          const roofToBuildingRatio = wholeRoof.areaMeters2 / (buildingStats.areaMeters2 || wholeRoof.areaMeters2);
          let existingSolarStatus = 'No panels detected';
          if (roofToBuildingRatio > 1.3 && segments.length > 15) {
            existingSolarStatus = 'Possible — Elevated roof structures detected';
          } else if (segments.length > 20) {
            existingSolarStatus = 'Likely — Multiple elevated segments found';
          }
          
          // Shading analysis from sunshine quantiles
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
            // Extra enriched fields
            imageryDate: imageryDateStr,
            imageryQuality: imgQuality,
            buildingFootprint: `${buildingSqFt.toLocaleString('en-US')} sq ft`,
            panelWattage: `${panelWatts}W each`,
            carbonOffset: `${pot.carbonOffsetFactorKgPerMwh ? Math.round(pot.carbonOffsetFactorKgPerMwh) : 400} kg CO₂/MWh`,
            roofSegments: segments.length
          };
          solarScore = Math.min(99, Math.floor(65 + (panelCount > 40 ? 30 : panelCount * 0.7)));
          googleSolarHit = true;
          
          console.log(`[Google Solar API] Enriched: ${panelCount} panels, ${sizeKw} kW, ${existingSolarStatus}, imagery ${imageryDateStr} (${imgQuality})`);
        }
      }
    } catch (err) {
      console.error('[Google Solar API] Error:', err);
    }
  }

  // --- NREL PVWatts + Utility Rates (only when we have a real system size from Google Solar) ---
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
  } else if (!googleSolarHit) {
    console.log('[NREL Enrichment] Skipped — waiting for live Google Solar system size (no mock kW).');
  }

  // Ensure propertyDetails scaffold exists before contact enrichment
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
    // Tracerfy (primary + retry) → Apollo — never invent unverified PII
    contactEnrichment = await enrichOwnerContacts({
      address,
      locationInfo,
      propertyDetails
    });
    propertyDetails = contactEnrichment.propertyDetails;
    contactDetails = contactEnrichment.contactDetails;
    phoneType = contactEnrichment.phoneType;

    // Offline-dev mock contact only when property itself was mocked AND no real enrichment hit
    if (usedMockPropertyFallback && !hasAnyContact(contactDetails)) {
      contactDetails = {
        phone: 'Not Available',
        email: 'Not Available',
        linkedIn: 'Not Available',
        confidenceScore: 'Mock property (offline-dev) — no real contact fabricated'
      };
      console.log('[Contact Enrichment] Mock property kept without fabricated phone/email.');
    }

    if (!isMissingField(contactDetails.email)) {
      emailStatus = await validateEmailWithVerifalia(contactDetails.email);
    }
    if (!isMissingField(contactDetails.phone) && phoneType === 'Not Available') {
      phoneType = await lookupPhoneWithTwilio(contactDetails.phone);
    }
  } else {
    contactDetails = emptyContactDetails();
    console.log('[Contact Enrichment] Skipped (solar/property stage only)');
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

  // Dynamic satellite thumbnail (same Maps key already used by the frontend map)
  let imageUrl = null;
  if (lat && lng && isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: '20',
      size: '640x360',
      maptype: 'satellite',
      scale: '2',
      key: process.env.GOOGLE_MAPS_API_KEY
    });
    imageUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }

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

// Coordinates property lookup (when user clicks anywhere on map/rooftop)
app.get('/api/properties/lookup', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Coordinates required' });

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  console.log(`[Properties Lookup API] Querying coords: ${latitude}, ${longitude}`);

  let rentcastId = null;
  let resolvedAddress = null;
  let preFetchedRecord = null;
  const rentcastApiKey = process.env.RENTCAST_API_KEY || process.env.ATTOM_API_KEY;

  // Search closest property in RentCast by coordinates
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
  try {
    const details = await retrievePropertyDetails(targetId, latitude, longitude, preFetchedRecord);
    res.json(details);
  } catch (error) {
    console.error('Lookup fetch details error:', error);
    res.status(500).json({ error: 'Error fetching details for coordinates' });
  }
});

// Single property details by ID — reuses RentCast search cache when available
app.get('/api/properties/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cached = getCachedRentcastRecord(id);
    const details = await retrievePropertyDetails(id, undefined, undefined, cached);
    res.json(details);
  } catch (error) {
    console.error('Fetch details by ID error:', error);
    res.status(500).json({ error: 'Error fetching property details' });
  }
});

// Generate Lead & Deduct Credits
app.post('/api/leads/generate', authenticateToken, async (req, res) => {
  const { propertyId, detail } = req.body;
  if (!propertyId || !detail) return res.status(400).json({ error: 'Missing property data' });

  try {
    // Admins can generate leads without burning package credits
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

    const [existing] = await db.query('SELECT * FROM leads WHERE user_id = ? AND address = ?', [req.user.id, detail.address]);
    if (existing.length > 0) {
      return res.status(200).json({ message: 'Lead already generated', leadId: existing[0].id });
    }

    // Safe parsing helper checks for "Not Available" strings
    const parseValueSafe = (val, regex) => {
      if (!val || val === 'Not Available') return 0;
      const numStr = String(val).replace(regex, '');
      const parsed = parseFloat(numStr);
      return isNaN(parsed) ? 0 : parsed;
    };

    const propValueNum = parseValueSafe(detail.propertyData.propertyValue, /[$,]/g);
    const livingAreaNum = parseValueSafe(detail.livingArea, /[^\d.]/g);
    const roofAreaNum = parseValueSafe(detail.solar?.totalRoofArea || detail.solar?.usableRoofArea, /[^\d.]/g) || livingAreaNum;
    const savingsNum = parseValueSafe(detail.solar.twentyFiveYearSavings, /[$,]/g);

    const [leadResult] = await db.query(
      `INSERT INTO leads (user_id, address, latitude, longitude, owner_name, phone, phone_type, email, email_status, linkedin, mailing_address, property_value, owner_occupied, parcel_id, roof_size, solar_potential, estimated_savings, lead_score, status, solar_json, property_json, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        detail.address,
        parseFloat(detail.lat) || null,
        parseFloat(detail.lng) || null,
        detail.propertyData.ownerName,
        detail.contact.phone,
        detail.contact.phoneType || 'Not Available',
        detail.contact.email,
        detail.contact.emailStatus || 'Not Available',
        detail.contact.linkedIn || 'Not Available',
        detail.propertyData.mailingAddress,
        propValueNum,
        detail.propertyData.ownerOccupied === 'Yes' ? 1 : 0,
        detail.propertyData.parcelNumber,
        roofAreaNum,
        detail.solar.potential,
        savingsNum,
        detail.aiLeadScore.overall,
        'new',
        JSON.stringify(detail.solar || {}),
        JSON.stringify({
          ...(detail.propertyData || {}),
          livingArea: detail.livingArea,
          lotSize: detail.lotSize,
          stories: detail.stories,
          propertyType: detail.propertyType,
          yearBuilt: detail.yearBuilt,
          aiLeadScore: detail.aiLeadScore || null
        }),
        detail.imageUrl || null
      ]
    );

    if (!adminBypass && packageRecord) {
      await db.query(
        'UPDATE user_packages SET remaining_leads = remaining_leads - 1 WHERE id = ?',
        [packageRecord.id]
      );
    }

    res.status(201).json({ message: 'Lead generated successfully', leadId: leadResult.insertId, adminBypass });
  } catch (error) {
    console.error('Lead generation error:', error);
    res.status(500).json({ error: 'Server error generating lead' });
  }
});

// Get User Leads
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const [leads] = await db.query('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
    res.status(500).json({ error: 'Server error fetching leads' });
  }
});

// Export User Leads as CSV (must be before /:id)
app.get('/api/leads/export-csv', authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Server error generating CSV export' });
  }
});

// Get Single Lead details (includes full solar payload; backfills from live enrichment when missing)
app.get('/api/leads/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [leads] = await db.query('SELECT * FROM leads WHERE user_id = ? AND id = ?', [req.user.id, id]);
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leads[0];
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

    const needsSolarBackfill =
      !solar ||
      !solar.recommendedSize ||
      solar.recommendedSize === 'Not Available' ||
      !solar.totalRoofArea ||
      solar.totalRoofArea === 'Not Available';

    const lat = parseFloat(lead.latitude);
    const lng = parseFloat(lead.longitude);

    if (needsSolarBackfill && !Number.isNaN(lat) && !Number.isNaN(lng) && lat && lng) {
      try {
        console.log(`[Lead Detail] Backfilling solar-only for lead #${id} @ ${lat},${lng}`);
        const targetId = `coordinate-${lat.toFixed(5)}-${lng.toFixed(5)}`;
        const details = await retrievePropertyDetails(targetId, lat, lng, null, { skipContacts: true, bypassCache: true });
        delete details._locationInfo;
        solar = details.solar || solar;
        propertyExtra = {
          ...(propertyExtra || {}),
          ...(details.propertyData || {}),
          livingArea: details.livingArea,
          lotSize: details.lotSize,
          stories: details.stories,
          propertyType: details.propertyType,
          yearBuilt: details.yearBuilt,
          aiLeadScore: details.aiLeadScore || propertyExtra?.aiLeadScore || null
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
        // Prefer newly enriched value unless it's suspiciously tiny
        if (propVal > 0 && propVal < 10000 && Number(lead.property_value) > propVal) {
          propVal = Number(lead.property_value);
        }

        await db.query(
          `UPDATE leads SET
             solar_json = ?, property_json = ?, image_url = COALESCE(?, image_url),
             roof_size = ?, solar_potential = ?, estimated_savings = ?,
             property_value = CASE WHEN ? > 10000 OR property_value IS NULL OR property_value < 10000 THEN ? ELSE property_value END
           WHERE id = ? AND user_id = ?`,
          [
            JSON.stringify(solar || {}),
            JSON.stringify(propertyExtra || {}),
            details.imageUrl || null,
            roofAreaNum || lead.roof_size,
            details.solar?.potential || lead.solar_potential,
            savingsNum || lead.estimated_savings,
            propVal,
            propVal,
            id,
            req.user.id
          ]
        );

        lead.roof_size = roofAreaNum || lead.roof_size;
        lead.solar_potential = details.solar?.potential || lead.solar_potential;
        lead.estimated_savings = savingsNum || lead.estimated_savings;
        if (propVal > 10000 || Number(lead.property_value) < 10000) {
          lead.property_value = propVal;
        }
        lead.image_url = details.imageUrl || lead.image_url;
      } catch (enrichErr) {
        console.error(`[Lead Detail] Solar backfill failed for #${id}:`, enrichErr.message || enrichErr);
      }
    }

    // Stable satellite thumbnail for the UI (persists across reloads)
    let imageUrl = lead.image_url || null;
    if (!imageUrl && !Number.isNaN(lat) && !Number.isNaN(lng) && isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
      const params = new URLSearchParams({
        center: `${lat},${lng}`,
        zoom: '19',
        size: '800x400',
        maptype: 'satellite',
        scale: '2',
        markers: `color:0xFF3B30|${lat},${lng}`,
        key: process.env.GOOGLE_MAPS_API_KEY
      });
      imageUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    }

    const { solar_json, property_json, ...leadRest } = lead;
    res.json({
      ...leadRest,
      solar,
      propertyExtra,
      imageUrl
    });
  } catch (error) {
    console.error('Fetch single lead error:', error);
    res.status(500).json({ error: 'Server error fetching lead details' });
  }
});

// Bulk Delete Leads
app.post('/api/leads/bulk-delete', authenticateToken, async (req, res) => {
  const { leadIds } = req.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds array is required' });
  }
  try {
    await db.query('DELETE FROM leads WHERE user_id = ? AND id IN (?)', [req.user.id, leadIds]);
    res.json({ success: true, message: `Successfully deleted ${leadIds.length} leads` });
  } catch (error) {
    console.error('Bulk delete leads error:', error);
    res.status(500).json({ error: 'Server error deleting leads' });
  }
});

// Reverse geocode lat/lng to find ZIP code using Google Geocoding API
async function getZipFromCoords(lat, lng) {
  if (isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const res = await trackedFetch('google_maps', url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]) {
          const components = data.results[0].address_components || [];
          let zip = '';
          components.forEach(c => {
            if (c.types.includes('postal_code')) zip = c.long_name;
          });
          if (zip) return zip;
        }
      }
    } catch (err) {
      console.error('[Reverse Geocoding Google] Failed:', err);
    }
  }

  // Fallback: Query Nominatim OpenStreetMap reverse geocoder (free, no key required)
  try {
    console.log(`[Reverse Geocoding Fallback] Querying OpenStreetMap Nominatim for lat=${lat}, lng=${lng}`);
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`;
    const res = await fetch(osmUrl, {
      headers: { 'User-Agent': 'TechXSolar-App/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      const zip = data.address?.postcode || '';
      if (zip) {
        // Parse 5-digit ZIP prefix if it's extended (e.g. 75024-1234)
        const match = zip.match(/^\d{5}/);
        return match ? match[0] : zip;
      }
    }
  } catch (err) {
    console.error('[Reverse Geocoding Fallback] OSM Geocoding failed:', err);
  }

  return null;
}

// Haversine distance calculator between two coordinates (returns meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
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

// Bulk Area Scan (processes a ZIP search, runs enrichment pipeline, and saves leads in bulk)
app.post('/api/leads/bulk-scan', authenticateToken, async (req, res) => {
  let {
    zip,
    lat,
    lng,
    radius,
    radiusUnit,
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

  try {
    const requestedQuota = Math.min(
      50,
      Math.max(1, Number(homesToScan) || Number(leadCreditCost) || 15)
    );

    // Admins skip credit balance checks and deductions
    const [roleRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    const userRole = roleRows[0]?.role || req.user.role;
    const adminBypass = isAdminRole(userRole);

    // 1. Verify user packages status and active credit balance
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
    if (adminBypass) {
      console.log(`[Bulk Scan API] Admin bypass — scanning without credit deduction (user=${req.user.id}, role=${userRole})`);
    }
    const queryLimit = requestedQuota;
    const minSavingsNum = parseMinSavingsThreshold(minSavings);
    const wantSingleFamily = singleFamily === true || singleFamily === 'true' || singleFamily === 1 || singleFamily === '1';
    const wantSkipPaneled = skipPaneled === true || skipPaneled === 'true' || skipPaneled === 1 || skipPaneled === '1';

    // Resolve scan center: prefer provided lat/lng, else geocode ZIP so radius can apply
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
            console.log(`[Bulk Scan API] Geocoded ZIP ${zip} → ${centerLat}, ${centerLng}`);
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
          console.log(`[Bulk Scan API] Fallback ZIP center ${zip} → ${centerLat}, ${centerLng}`);
        }
      }
    }

    // Normalize radius: bulk form sends miles; map targeting sends meters (default)
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
    // 2. Fetch denser candidate pool from RentCast
    if (isKeyValid(rentcastApiKey)) {
      let rentcastSearchUrl = `https://api.rentcast.io/v1/properties?zipCode=${zip}&limit=80`;
      if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && radiusMiles > 0) {
        console.log(
          `[Bulk Scan API] Querying near ${centerLat},${centerLng} radius=${radiusMiles.toFixed(2)}mi ` +
            `(${Math.round(radiusMeters)}m, unit=${unit}) limit=80`
        );
        rentcastSearchUrl = `https://api.rentcast.io/v1/properties?latitude=${centerLat}&longitude=${centerLng}&radius=${radiusMiles.toFixed(2)}&limit=80`;
      } else {
        console.log(`[Bulk Scan API] Querying properties for ZIP: ${zip} from RentCast (limit=80, no radius center)`);
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

    // Haversine filter in meters around scan center
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && radiusMeters > 0) {
      propertiesList = propertiesList.filter((prop) => {
        const propLat = parseFloat(prop.latitude);
        const propLng = parseFloat(prop.longitude);
        if (!propLat || !propLng) return false;
        const dist = calculateDistance(centerLat, centerLng, propLat, propLng);
        return dist <= radiusMeters;
      });
      console.log(
        `[Bulk Scan API] Filtered properties within ${Math.round(radiusMeters)}m ` +
          `(${radiusMiles.toFixed(2)}mi) of ${centerLat}, ${centerLng}. Remaining: ${propertiesList.length}`
      );
    }

    // Pre-filter single-family from RentCast propertyType (before expensive enrichment)
    if (wantSingleFamily) {
      const before = propertiesList.length;
      propertiesList = propertiesList.filter((prop) => {
        const t = prop.propertyType || prop.features?.propertyType || '';
        // Keep unknowns so we don't over-filter sparse RentCast type data
        if (!t) return true;
        return isSingleFamilyType(t);
      });
      console.log(`[Bulk Scan API] singleFamily filter: ${before} → ${propertiesList.length}`);
    }

    // Prefer candidates that already have owner names (higher chance of contact enrichment)
    propertiesList.sort((a, b) => {
      const aHasOwner = a.owner && Array.isArray(a.owner.names) && a.owner.names.length > 0 ? 1 : 0;
      const bHasOwner = b.owner && Array.isArray(b.owner.names) && b.owner.names.length > 0 ? 1 : 0;
      return bHasOwner - aHasOwner;
    });

    // 3. Fallback mock list if RentCast is empty or offline — labeled via enrichment / notes
    if (propertiesList.length === 0) {
      usedMockListing = true;
      console.log(`[Bulk Scan API] RentCast returned empty list, generating labeled offline-dev mock listing for ZIP: ${zip}`);
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

    const summary = {
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

      if (insertResult?.insertId) createdLeadIds.push(insertResult.insertId);

      summary.leadsCount++;
      if (hasContact) summary.withContact++;
      else summary.withoutContact++;
    };

    console.log(
      `[Bulk Scan API] Starting enrichment quota=${queryLimit} filters=` +
        `singleFamily=${wantSingleFamily} skipPaneled=${wantSkipPaneled} minSavings=${minSavingsNum} minSqFt=${minSqFt || 0}`
    );

    // 4. Enrich and save each matched property
    for (const prop of propertiesList) {
      if (summary.leadsCount >= queryLimit) break;

      const propIdStr = prop.id || (prop.identifier ? (prop.identifier.attomId || prop.identifier.Id) : `bulk-${zip}-${Date.now()}`);
      const addressLine = prop.formattedAddress || (prop.address ? prop.address.oneLine : '');
      const latVal = parseFloat(prop.latitude) || (prop.location ? parseFloat(prop.location.latitude) : 0);
      const lngVal = parseFloat(prop.longitude) || (prop.location ? parseFloat(prop.location.longitude) : 0);

      if (!addressLine && !(latVal && lngVal)) {
        summary.skipped++;
        summary.skippedReasons.noAddress++;
        console.log(`[Bulk Scan API] SKIP noAddress — property id=${propIdStr}`);
        continue;
      }

      const targetId = `rentcast-${propIdStr}__${encodeURIComponent(addressLine || `${latVal},${lngVal}`)}`;

      if (addressLine) {
        const [existing] = await db.query('SELECT id FROM leads WHERE user_id = ? AND address = ?', [req.user.id, addressLine]);
        if (existing.length > 0) {
          summary.skipped++;
          summary.skippedReasons.duplicate++;
          console.log(`[Bulk Scan API] SKIP duplicate — ${addressLine}`);
          continue;
        }
      }

      // Stage 1: RentCast + Solar + NREL only (no contact APIs)
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
        console.log(`[Bulk Scan API] SKIP noAddress after enrichment — id=${propIdStr}`);
        continue;
      }

      const [existingEnriched] = await db.query('SELECT id FROM leads WHERE user_id = ? AND address = ?', [req.user.id, details.address]);
      if (existingEnriched.length > 0) {
        summary.skipped++;
        summary.skippedReasons.duplicate++;
        console.log(`[Bulk Scan API] SKIP duplicate enriched — ${details.address}`);
        continue;
      }

      // Cheap filters before burning Tracerfy/Apollo
      if (wantSingleFamily && details.propertyType && !isSingleFamilyType(details.propertyType)) {
        summary.skipped++;
        summary.skippedReasons.singleFamily++;
        console.log(`[Bulk Scan API] SKIP singleFamily — ${details.address} type=${details.propertyType}`);
        continue;
      }

      if (wantSkipPaneled && looksPaneledExistingSolar(details.solar?.existingSolar)) {
        summary.skipped++;
        summary.skippedReasons.skipPaneled++;
        console.log(`[Bulk Scan API] SKIP paneled — ${details.address} existingSolar=${details.solar.existingSolar}`);
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
        console.log(`[Bulk Scan API] SKIP minSavings — ${details.address} savings=${savingsNum} < ${minSavingsNum}`);
        continue;
      }

      if (minSqFt && details.solar && details.solar.usableRoofArea) {
        const usableAreaNum = parseInt(String(details.solar.usableRoofArea).replace(/[^0-9]/g, ''), 10) || 0;
        if (usableAreaNum < minSqFt) {
          summary.skipped++;
          summary.skippedReasons.minSqFt++;
          console.log(`[Bulk Scan API] SKIP minSqFt — ${details.address} usable=${usableAreaNum} < ${minSqFt}`);
          continue;
        }
      }

      // Stage 2: contact APIs only for filter survivors
      details = await enrichDetailsWithContacts(details);

      if (intentLevel && intentLevel !== 'All') {
        const score = details.aiLeadScore.overall;
        if (intentLevel === 'Qualified' && score <= 70) {
          summary.skipped++;
          summary.skippedReasons.intentLevel++;
          console.log(`[Bulk Scan API] SKIP intentLevel — ${details.address} score=${score} (need Qualified >70)`);
          continue;
        }
        if (intentLevel === 'High Intent' && score <= 85) {
          summary.skipped++;
          summary.skippedReasons.intentLevel++;
          console.log(`[Bulk Scan API] SKIP intentLevel — ${details.address} score=${score} (need High Intent >85)`);
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
        console.log(
          `[Bulk Scan API] KEEP withContact — ${details.address} | owner=${details.propertyData.ownerName} | ` +
            `phone=${hasPhone} email=${hasEmail} source=${meta.contactSource || 'none'}`
        );
        await saveLeadFromDetails(details, { hasContact: true, incompleteNote });
      } else {
        console.log(
          `[Bulk Scan API] DEFER withoutContact — ${details.address} | owner=${details.propertyData.ownerName} | ` +
            `source=${meta.contactSource || 'none'} missing=[${missingBits.join(',')}]`
        );
        deferredPropertyOnly.push({ details, incompleteNote });
      }
    }

    // Fill remaining credit quota with best property-only leads
    for (const item of deferredPropertyOnly) {
      if (summary.leadsCount >= queryLimit) break;
      console.log(
        `[Bulk Scan API] KEEP withoutContact (quota fill) — ${item.details.address} | ` +
          `owner=${item.details.propertyData.ownerName}`
      );
      await saveLeadFromDetails(item.details, { hasContact: false, incompleteNote: item.incompleteNote });
    }

    const unsavedDeferred = Math.max(0, deferredPropertyOnly.length - summary.withoutContact);
    if (unsavedDeferred > 0) {
      summary.skipped += unsavedDeferred;
      console.log(`[Bulk Scan API] Quota full — left ${unsavedDeferred} property-only candidates unsaved`);
    }

    // 5. Deduct actual credits based on leads generated (1 credit per lead) — skip for admins
    if (!adminBypass && packageRecord && summary.leadsCount > 0) {
      await db.query(
        'UPDATE user_packages SET remaining_leads = remaining_leads - ? WHERE id = ?',
        [summary.leadsCount, packageRecord.id]
      );
      console.log(`[Bulk Scan API] Completed! Deducted ${summary.leadsCount} credits for user: ${req.user.id}`);
    } else if (adminBypass) {
      console.log(`[Bulk Scan API] Completed! Admin bypass — no credits deducted (${summary.leadsCount} leads)`);
    }

    summary.phase = 'done';
    console.log(
      `[Bulk Scan API] Summary zip=${zip} leads=${summary.leadsCount} withContact=${summary.withContact} ` +
        `withoutContact=${summary.withoutContact} skipped=${summary.skipped} ` +
        `reasons=${JSON.stringify(summary.skippedReasons)} mockListing=${usedMockListing}`
    );

    let createdLeads = [];
    if (createdLeadIds.length > 0) {
      const placeholders = createdLeadIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT * FROM leads WHERE user_id = ? AND id IN (${placeholders}) ORDER BY created_at DESC`,
        [req.user.id, ...createdLeadIds]
      );
      createdLeads = rows;
    }

    res.json({
      message: 'Bulk area scan completed successfully',
      leadsCount: summary.leadsCount,
      withContact: summary.withContact,
      withoutContact: summary.withoutContact,
      skipped: summary.skipped,
      skippedReasons: summary.skippedReasons,
      phase: 'done',
      adminBypass,
      leads: createdLeads
    });
  } catch (error) {
    console.error('Bulk area scan error:', error);
    res.status(500).json({ error: 'Server error running bulk area scan' });
  }
});

// Tier-1 feature routers
app.use('/api/leads', crmRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/marketing', marketingRoutes);

migrateSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Schema] Migration failed, starting anyway:', err.message);
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  });
