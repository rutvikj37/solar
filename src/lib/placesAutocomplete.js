/** Skip Places (New) after project-level denial (falls back to Nominatim). */
let placesAutocompleteDenied = false;

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
  return {
    id: String(item.place_id || item.osm_id),
    description: item.display_name,
    mainText:
      item.address?.house_number && item.address?.road
        ? `${item.address.house_number} ${item.address.road}`
        : item.address?.city || item.address?.town || item.display_name.split(',')[0],
    secondaryText: item.display_name.split(',').slice(1).join(',').trim(),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };
}

async function fetchNominatimSuggestions(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us,ca`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map(formatNominatimRow);
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

      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['us', 'ca'],
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        sessionToken: sessionTokenRef.current || undefined,
      });

      const formatted = (results || [])
        .map((s) => s.placePrediction)
        .filter(Boolean)
        .slice(0, 5)
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
          };
        });

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

  return { address: fullAddress };
}

export function resetPlacesAutocompleteDenial() {
  placesAutocompleteDenied = false;
}
