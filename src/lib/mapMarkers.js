/** Shared Google Maps pin SVG — anchor at teardrop tip (12, 22) in 24×24 viewBox. */
export const MAP_PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

export const MAP_PIN_ANCHOR = { x: 12, y: 22 };
export const MAP_PIN_LABEL_ORIGIN = { x: 12, y: 9 };

function scoreFillColor(score, existingSolarLikely) {
  if (existingSolarLikely) return '#94a3b8';
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#64748b';
}

/** Verified score for a map list item, or null when only a preview / nothing is known. */
export function verifiedMarkerScore(prop) {
  if (prop?.scoreSource !== 'verified') return null;
  const n = Number(prop.solarScore);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function markerTitle(prop) {
  const score = verifiedMarkerScore(prop);
  if (score != null) return `${prop.address} · Solar score ${score} (Verified)`;
  if (prop?.scoreSource === 'preview' && prop.previewSystemKw) {
    return `${prop.address} · Preview ≈ ${prop.previewSystemKw} kW from living area (not verified)`;
  }
  return `${prop?.address || 'Property'} · Not scored yet`;
}

export function buildScoreMarkerIcon(
  google,
  { score = 0, existingSolarLikely = false, selected = false, unscored = false } = {},
) {
  const fill = selected ? '#38bdf8' : unscored && !existingSolarLikely ? '#cbd5e1' : scoreFillColor(score, existingSolarLikely);
  const scale = selected ? 2.4 : 1.9;
  return {
    path: MAP_PIN_PATH,
    fillColor: fill,
    fillOpacity: unscored && !selected ? 0.7 : 0.95,
    strokeColor: selected ? '#ffffff' : '#080B1A',
    strokeWeight: selected ? 2.5 : 1.4,
    scale,
    anchor: new google.maps.Point(MAP_PIN_ANCHOR.x, MAP_PIN_ANCHOR.y),
    labelOrigin: new google.maps.Point(MAP_PIN_LABEL_ORIGIN.x, MAP_PIN_LABEL_ORIGIN.y)
  };
}

export function buildLeadMarkerIcon(google, { fillColor = '#6366f1', scale = 1.5 } = {}) {
  return {
    path: MAP_PIN_PATH,
    fillColor,
    fillOpacity: 0.95,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
    scale,
    anchor: new google.maps.Point(MAP_PIN_ANCHOR.x, MAP_PIN_ANCHOR.y),
    labelOrigin: new google.maps.Point(MAP_PIN_LABEL_ORIGIN.x, MAP_PIN_LABEL_ORIGIN.y)
  };
}

/** Preferred pin API (replaces deprecated google.maps.Marker). Requires mapId on the Map. */
export async function placeAdvancedLeadMarker(
  google,
  { map, position, title, fillColor = '#6366f1', draggable = false },
) {
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');
  const pin = new PinElement({
    background: fillColor,
    borderColor: '#ffffff',
    glyphColor: '#ffffff',
  });
  return new AdvancedMarkerElement({
    map,
    position,
    title: title || 'Lead',
    content: pin, // PinElement itself (pin.element is deprecated)
    gmpDraggable: draggable,
  });
}

