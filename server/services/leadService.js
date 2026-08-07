import db from '../db.js';
import { checkLeadCreditAccess } from '../routes/billing.js';
import { isAdminRole } from '../middleware/auth.js';
import { trackedFetch } from './apiUsage.js';
import { cacheRentcastRecords } from './rentcastCache.js';
import {
  getFallbackZipCoords,
  isSingleFamilyType,
  parseMinSavingsThreshold,
  looksPaneledExistingSolar,
  calculateDistance,
  retrievePropertyDetails,
  enrichDetailsWithContacts
} from './propertyService.js';
import { isMissingField, isPlaceholderOwnerName } from './contactEnrichmentService.js';

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

export async function getZipFromCoords(lat, lng) {
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
        const match = zip.match(/^\d{5}/);
        return match ? match[0] : zip;
      }
    }
  } catch (err) {
    console.error('[Reverse Geocoding Fallback] OSM Geocoding failed:', err);
  }

  return null;
}
