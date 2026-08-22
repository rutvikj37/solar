export function looksLikeStreetAddress(query) {
  const q = String(query || '').trim();
  if (!q) return false;
  if (/^\d{5}(-\d{4})?$/.test(q)) return false;
  return /^\d+[A-Za-z]?\s+[A-Za-z]/.test(q);
}

export function pickBestGeocodeResult(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const locRank = { ROOFTOP: 0, RANGE_INTERPOLATED: 1, GEOMETRIC_CENTER: 2, APPROXIMATE: 3 };
  const typeScore = (types = []) => {
    if (types.includes('street_address') || types.includes('premise') || types.includes('subpremise')) {
      return 0;
    }
    if (types.includes('route')) return 2;
    return 1;
  };
  return [...results].sort((a, b) => {
    const aRank = (locRank[a.geometry?.location_type] ?? 9) + typeScore(a.types) * 0.1;
    const bRank = (locRank[b.geometry?.location_type] ?? 9) + typeScore(b.types) * 0.1;
    return aRank - bRank;
  })[0];
}

export async function geocodeAddress(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  if (window.google?.maps?.Geocoder) {
    const geocoder = new window.google.maps.Geocoder();
    const result = await new Promise((resolve) => {
      geocoder.geocode({ address: q }, (results, status) => {
        if (status === 'OK' && results?.length) resolve(pickBestGeocodeResult(results));
        else resolve(null);
      });
    });
    if (result?.geometry?.location) {
      return {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        formattedAddress: result.formatted_address || q,
      };
    }
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=us,ca`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = rows?.[0];
  if (!row) return null;
  return {
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lon),
    formattedAddress: row.display_name || q,
  };
}

export async function reverseGeocodeLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (window.google?.maps?.Geocoder) {
    const geocoder = new window.google.maps.Geocoder();
    const result = await new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) resolve(results[0]);
        else resolve(null);
      });
    });
    if (result) {
      return {
        lat,
        lng,
        formattedAddress: result.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return { lat, lng, formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  const data = await res.json();
  return {
    lat,
    lng,
    formattedAddress: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
}

export function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
