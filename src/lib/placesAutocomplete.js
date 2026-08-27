import { geocodeAddress, looksLikeStreetAddress } from './geocodeHelpers.js';

/** Skip Places (New) after project-level denial (falls back to Nominatim). */
let placesAutocompleteDenied = false;

const HIGHWAY_RE =
  /\b(u\.?\s*s\.?\s*(route|hwy|highway)|u\.?\s*s\.?\s*\d+|route\s+\d{1,4}|interstate\s+\d+|i[\-\s]?\d+)\b/i;
const STREET_SUFFIX_RE =
  /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|cir|circle|trl|trail)\b/i;
const ZIP_LEADING_RE = /^\d{5}\b/;

function parseQueryTokens(query) {
  const q = String(query || '').trim();
  const houseMatch = q.match(/^(\d+[a-z]?)\s+/i);
  const houseNumber = houseMatch?.[1]?.toLowerCase() || null;
  const afterHouse = houseMatch ? q.slice(houseMatch[0].length) : q;
  const streetPart = afterHouse.split(',')[0].trim().toLowerCase();
  const streetTokens = streetPart
    .split(/\s+/)
    .filter(
      (t) => t && !/^(ste|suite|unit|apt|#|fl|floor)$/i.test(t) && !/^\d+[a-z]?$/i.test(t),
    );
  return { houseNumber, streetPart, streetTokens };
}

function isHighwayText(text) {
  return HIGHWAY_RE.test(String(text || ''));
}

/** Client-side re-rank so typed street addresses beat highway/ZIP noise. */
export function scoreAddressSuggestion(item, query) {
  const q = String(query || '').trim();
  if (!q) return 0;

  const text = `${item.mainText || ''} ${item.secondaryText || ''} ${item.description || ''}`.toLowerCase();
  const mainLower = String(item.mainText || '').toLowerCase();
  let score = 0;

  const types = item.types || item.placePrediction?.types || [];
  if (Array.isArray(types)) {
    if (types.includes('street_address') || types.includes('premise') || types.includes('subpremise')) {
      score += 30;
    }
    if (types.includes('route')) score -= 40;
  }

  if (looksLikeStreetAddress(q)) {
    const { houseNumber, streetTokens } = parseQueryTokens(q);

    if (isHighwayText(text)) score -= 120;
    if (ZIP_LEADING_RE.test(item.mainText || '')) score -= 80;

    if (houseNumber && mainLower.startsWith(houseNumber)) score += 25;
    else if (houseNumber && text.includes(houseNumber)) score += 10;

    for (const token of streetTokens) {
      if (token.length >= 3 && text.includes(token)) score += 12;
    }

    const primaryStreet = streetTokens.find((t) => t.length >= 4);
    if (primaryStreet && mainLower.includes(primaryStreet)) score += 20;

    if (STREET_SUFFIX_RE.test(q) && STREET_SUFFIX_RE.test(mainLower)) score += 10;
  }

  if (item.mainText && item.mainText.length < 60) score += 2;

  return score;
}

export function rankAddressSuggestions(suggestions, query) {
  if (!Array.isArray(suggestions) || !suggestions.length) return [];

  const ranked = suggestions
    .map((item) => ({ item, score: scoreAddressSuggestion(item, query) }))
    .filter(({ score }) => score > -100)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item }) => item);

  return ranked.length ? ranked : suggestions.slice(0, 5);
}

export async function ensurePlacesLibrary() {
  if (window.google?.maps?.places?.AutocompleteSuggestion) {
    return window.google.maps.places;
  }
  if (typeof window.google?.maps?.importLibrary === 'function') {
    return window.google.maps.importLibrary('places');
  }
  return null;
}

function formatNominatimRow(item) {
  const road = item.address?.road || '';
  const house = item.address?.house_number || '';
  const mainText =
    house && road
      ? `${house} ${road}`
      : road || item.address?.city || item.address?.town || item.display_name.split(',')[0];
  return {
    id: String(item.place_id || item.osm_id),
    description: item.display_name,
    mainText,
    secondaryText: item.display_name.split(',').slice(1).join(',').trim(),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    types: road && house ? ['street_address'] : [],
  };
}

async function fetchNominatimSuggestions(query) {
  const q = String(query || '').trim();
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8&countrycodes=us,ca`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const filtered = (data || []).filter((item) => {
    if (!looksLikeStreetAddress(q)) return true;
    const road = item.address?.road || '';
    const lead = String(item.display_name || '').split(',')[0];
    if (isHighwayText(road) || isHighwayText(lead)) return false;
    if (ZIP_LEADING_RE.test(lead)) return false;
    return true;
  });
  return rankAddressSuggestions(filtered.map(formatNominatimRow), q);
}

/**
 * Address suggestions — Places API (New), with Nominatim fallback.
 */
export async function fetchAddressSuggestions(query, sessionTokenRef) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];

  if (!placesAutocompleteDenied) {
    try {
      const places = await ensurePlacesLibrary();
      const AutocompleteSuggestion = places?.AutocompleteSuggestion;
      const AutocompleteSessionToken = places?.AutocompleteSessionToken;
      if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        throw new Error('Places Autocomplete (New) unavailable');
      }

      if (!sessionTokenRef.current && AutocompleteSessionToken) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      const isStreetQuery = looksLikeStreetAddress(q);
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['us', 'ca'],
        // Street-number queries: address types only. Rural roads still use route/geocode.
        includedPrimaryTypes: isStreetQuery
          ? ['street_address', 'premise', 'subpremise']
          : ['street_address', 'premise', 'subpremise', 'route', 'geocode'],
        sessionToken: sessionTokenRef.current || undefined,
      });

      const formatted = rankAddressSuggestions(
        (results || [])
          .map((s) => s.placePrediction)
          .filter(Boolean)
          .map((prediction) => {
            const fullText = prediction.text?.text || prediction.text?.toString?.() || '';
            const main =
              prediction.mainText?.text ||
              prediction.structuredFormat?.mainText?.text ||
              fullText.split(',')[0] ||
              fullText;
            const secondary =
              prediction.secondaryText?.text ||
              prediction.structuredFormat?.secondaryText?.text ||
              fullText.split(',').slice(1).join(',').trim();
            return {
              id: prediction.placeId || fullText,
              description: fullText,
              mainText: main,
              secondaryText: secondary,
              placeId: prediction.placeId || null,
              placePrediction: prediction,
              types: prediction.types || [],
            };
          }),
        q,
      );

      if (formatted.length) return formatted;
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (/denied|not.?enabled|PERMISSION|ApiNotActivated|legacy/i.test(msg)) {
        placesAutocompleteDenied = true;
      }
    }
  }

  return fetchNominatimSuggestions(q);
}

/**
 * Resolve a suggestion row to { address, lat, lng }.
 */
export async function resolveAddressSuggestion(item, sessionTokenRef) {
  const fullAddress = item.description || item.mainText || '';

  if (item.lat != null && item.lng != null) {
    return { address: fullAddress, lat: item.lat, lng: item.lng };
  }

  if (item.placePrediction?.toPlace) {
    try {
      const place = item.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'displayName'],
      });
      if (sessionTokenRef) sessionTokenRef.current = null;
      const address = place.formattedAddress || place.displayName || fullAddress;
      if (place.location) {
        return {
          address,
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (item.placeId && window.google?.maps?.Geocoder) {
    const geocoder = new window.google.maps.Geocoder();
    const result = await new Promise((resolve) => {
      geocoder.geocode({ placeId: item.placeId }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) resolve(results[0]);
        else resolve(null);
      });
    });
    if (result?.geometry?.location) {
      return {
        address: result.formatted_address || fullAddress,
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
      };
    }
  }

  // Last resort: geocode the selected description (not a free-typed partial).
  if (fullAddress) {
    const geocoded = await geocodeAddress(fullAddress);
    if (geocoded?.lat != null && geocoded?.lng != null) {
      return {
        address: geocoded.formattedAddress || fullAddress,
        lat: geocoded.lat,
        lng: geocoded.lng,
      };
    }
  }

  return { address: fullAddress };
}

export function resetPlacesAutocompleteDenial() {
  placesAutocompleteDenied = false;
}
